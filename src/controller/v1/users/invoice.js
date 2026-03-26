import Invoice from '../../../models/v1/users/invoice.js';
import MonthlyPlan from '../../../models/v1/users/monthlyPlan.js';
import { sendEmails } from '../../../utils/resend.js';
import { updateMonthlyPlanTotals } from '../../../utils/helper.js';
import {
  buildInvoiceEmailTemplate,
  generateInvoicePdfBuffer,
  getInvoiceFilename,
  getInvoiceTotal,
} from '../../../utils/invoiceDocument.js';

const normalizeLineItems = (lineItems = []) =>
  lineItems.map((item) => ({
    description: item?.description?.trim(),
    quantity: Number(item?.quantity),
    unitPrice: Number(item?.unitPrice),
  }));

const validateInvoicePayload = (payload) => {
  const {
    name,
    billedParty,
    billedPartyEmail,
    currency,
    invoiceDate,
    lineItems = [],
  } = payload;

  if (!name?.trim()) return 'Invoice name is required';
  if (!billedParty?.trim()) return 'Billed party is required';
  if (!billedPartyEmail?.trim()) return 'Billed party email is required';
  if (!currency?.trim()) return 'Currency is required';
  if (!invoiceDate) return 'Invoice date is required';
  if (!Array.isArray(lineItems) || lineItems.length < 1) {
    return 'At least one line item is required';
  }

  const invalidLine = normalizeLineItems(lineItems).some(
    (item) =>
      !item.description || Number.isNaN(item.quantity) || item.quantity <= 0 || Number.isNaN(item.unitPrice) || item.unitPrice < 0
  );

  if (invalidLine) {
    return 'Each line item must have description, quantity > 0 and unit price >= 0';
  }

  return null;
};

const createInvoice = async (req, res) => {
  try {
    const validationMessage = validateInvoicePayload(req.body);
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const invoice = await Invoice.create({
      name: req.body.name.trim(),
      billedParty: req.body.billedParty.trim(),
      billedPartyEmail: req.body.billedPartyEmail.trim().toLowerCase(),
      currency: req.body.currency.trim().toUpperCase(),
      invoiceDate: req.body.invoiceDate,
      dueDate: req.body.dueDate || undefined,
      note: req.body.note?.trim(),
      lineItems: normalizeLineItems(req.body.lineItems),
      user: req.user._id,
    });

    return res.status(201).json({
      data: invoice,
      status: 201,
      message: 'Invoice created successfully',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const requestedPage = Number(req.query.page);
    const page = Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isNaN(requestedLimit) || requestedLimit < 1 ? 10 : Math.min(requestedLimit, 10);
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search?.trim();
    const query = { user: req.user._id };

    if (['draft', 'sent', 'paid'].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { billedParty: { $regex: search, $options: 'i' } },
        { billedPartyEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Invoice.countDocuments(query),
    ]);

    const hasMore = skip + invoices.length < total;

    return res.status(200).json({
      data: invoices,
      status: 200,
      pagination: {
        page,
        limit,
        total,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const editInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const validationMessage = validateInvoicePayload(req.body);
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, user: req.user._id },
      {
        name: req.body.name.trim(),
        billedParty: req.body.billedParty.trim(),
        billedPartyEmail: req.body.billedPartyEmail.trim().toLowerCase(),
        currency: req.body.currency.trim().toUpperCase(),
        invoiceDate: req.body.invoiceDate,
        dueDate: req.body.dueDate || undefined,
        note: req.body.note?.trim(),
        lineItems: normalizeLineItems(req.body.lineItems),
      },
      { new: true }
    ).select('-__v');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    return res
      .status(200)
      .json({ data: invoice, status: 200, message: 'Invoice updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const deleteInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedInvoice = await Invoice.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });
    if (!deletedInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    return res
      .status(200)
      .json({ message: 'Invoice deleted successfully', status: 200 });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const markInvoiceAsPaid = async (req, res) => {
  const { id } = req.params;
  try {
    const shouldMarkAsPaid = req.body?.paid !== false;
    const linkToIncome = Boolean(req.body?.linkToIncome);
    const monthlyPlanId = req.body?.monthlyPlanId;
    const existingInvoice = await Invoice.findOne({ _id: id, user: req.user._id });
    if (!existingInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const nextStatus = shouldMarkAsPaid
      ? 'paid'
      : existingInvoice.sentAt
      ? 'sent'
      : 'draft';
    const update = shouldMarkAsPaid
      ? { status: 'paid', paidAt: new Date() }
      : { status: nextStatus, paidAt: null };

    let paymentLink = existingInvoice.paymentLink;
    if (shouldMarkAsPaid && linkToIncome) {
      if (!monthlyPlanId) {
        return res
          .status(400)
          .json({ message: 'Please select a monthly plan to link income' });
      }

      const plan = await MonthlyPlan.findOne({
        _id: monthlyPlanId,
        user: req.user._id,
      });
      if (!plan) {
        return res.status(404).json({ message: 'Monthly plan not found' });
      }

      if (!existingInvoice?.paymentLink?.incomeId) {
        plan.incomes.push({
          name: `Invoice payment - ${existingInvoice.name}`,
          amount: getInvoiceTotal(existingInvoice),
          date: new Date(),
        });
        const createdIncome = plan.incomes[plan.incomes.length - 1];
        await plan.save();
        await updateMonthlyPlanTotals(plan._id);
        paymentLink = {
          monthlyPlanId: plan._id,
          incomeId: createdIncome._id,
        };
      }
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { ...update, paymentLink },
      {
        new: true,
      }
    ).select('-__v');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    return res.status(200).json({
      data: invoice,
      status: 200,
      message: shouldMarkAsPaid ? 'Invoice marked as paid' : 'Invoice marked as unpaid',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const sendInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await Invoice.findOne({ _id: id, user: req.user._id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const billedFromName = req.user?.first_name || 'Expense Tracker';
    const billedFromEmail = req.user?.email || '';
    const pdfBuffer = await generateInvoicePdfBuffer(invoice, {
      billedFromName,
      billedFromEmail,
    });

    await sendEmails(
      {
        to: invoice.billedPartyEmail,
        subject: `Invoice: ${invoice.name}`,
        html: buildInvoiceEmailTemplate({
          invoice,
          type: 'invoice',
          billedFromName,
          billedFromEmail,
        }),
        attachments: [
          {
            filename: getInvoiceFilename(invoice),
            content: pdfBuffer.toString('base64'),
          },
        ],
      }
    );

    invoice.status = invoice.status === 'paid' ? 'paid' : 'sent';
    invoice.sentAt = new Date();
    await invoice.save();

    return res.status(200).json({
      data: invoice,
      status: 200,
      message: `Invoice sent to ${invoice.billedPartyEmail}`,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const sendInvoiceReminder = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await Invoice.findOne({ _id: id, user: req.user._id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'draft') {
      return res
        .status(400)
        .json({ message: 'Send the invoice before sending reminders' });
    }

    const billedFromName = req.user?.first_name || 'Expense Tracker';
    const billedFromEmail = req.user?.email || '';
    const pdfBuffer = await generateInvoicePdfBuffer(invoice, {
      billedFromName,
      billedFromEmail,
    });

    await sendEmails(
      {
        to: invoice.billedPartyEmail,
        subject: `Reminder: ${invoice.name}`,
        html: buildInvoiceEmailTemplate({
          invoice,
          type: 'reminder',
          billedFromName,
          billedFromEmail,
        }),
        attachments: [
          {
            filename: getInvoiceFilename(invoice),
            content: pdfBuffer.toString('base64'),
          },
        ],
      }
    );

    return res.status(200).json({
      status: 200,
      message: `Reminder sent to ${invoice.billedPartyEmail}`,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const downloadInvoicePdf = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await Invoice.findOne({ _id: id, user: req.user._id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const billedFromName = req.user?.first_name || 'Expense Tracker';
    const billedFromEmail = req.user?.email || '';
    const pdfBuffer = await generateInvoicePdfBuffer(invoice, {
      billedFromName,
      billedFromEmail,
    });
    const filename = getInvoiceFilename(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export {
  createInvoice,
  getAllInvoices,
  editInvoice,
  deleteInvoice,
  markInvoiceAsPaid,
  sendInvoice,
  sendInvoiceReminder,
  downloadInvoicePdf,
};
