import PDFDocument from 'pdfkit';

const APP_NAME = 'ExpenseTracker';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString();
};

const formatMoney = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const getInvoiceTotal = (invoice) =>
  invoice.lineItems.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  );

const getInvoiceFilename = (invoice) => {
  const safeName = (invoice.name || 'invoice').replace(/[^a-zA-Z0-9-_]+/g, '-');
  return `${safeName}.pdf`;
};

const buildInvoiceEmailTemplate = ({
  invoice,
  type = 'invoice',
  billedFromName = 'Expense Tracker',
  billedFromEmail = '',
}) => {
  const isReminder = type === 'reminder';
  const total = getInvoiceTotal(invoice);

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <div style="max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0f172a; color: #ffffff; padding: 20px 24px;">
          <h2 style="margin: 0; font-size: 20px;">
            ${isReminder ? 'Invoice Reminder' : 'Invoice'}
          </h2>
          <p style="margin: 8px 0 0; color: #cbd5e1;">
            ${invoice.name}
          </p>
        </div>
        <div style="padding: 24px;">
          <p style="margin-top: 0;">Hi ${invoice.billedParty},</p>
          <p>
            ${
              isReminder
                ? 'This is a friendly reminder for the invoice attached to this email.'
                : 'Please find your invoice attached to this email.'
            }
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin: 16px 0;">
            <p style="margin: 0 0 4px;"><strong>Billed from:</strong> ${billedFromName}${
              billedFromEmail ? ` (${billedFromEmail})` : ''
            }</p>
            <p style="margin: 0 0 4px;"><strong>Invoice date:</strong> ${formatDate(invoice.invoiceDate)}</p>
            <p style="margin: 0 0 4px;"><strong>Due date:</strong> ${formatDate(invoice.dueDate)}</p>
            <p style="margin: 0;"><strong>Total:</strong> ${formatMoney(total, invoice.currency)}</p>
          </div>
          ${
            invoice.note
              ? `<p style="margin: 0 0 14px;"><strong>Note:</strong> ${invoice.note}</p>`
              : ''
          }
          <p style="margin-bottom: 0;">Thank you.</p>
        </div>
      </div>
    </div>
  `;
};

const generateInvoicePdfBuffer = (
  invoice,
  { billedFromName = 'Expense Tracker', billedFromEmail = '' } = {}
) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const total = getInvoiceTotal(invoice);
      const subtotal = total;

      doc
        .fontSize(26)
        .fillColor('#0f172a')
        .text('INVOICE', 50, 40, { align: 'right' })
        .fontSize(11)
        .fillColor('#64748b')
        .text(APP_NAME, 50, 64, { align: 'right' });
      doc
        .fontSize(11)
        .fillColor('#334155')
        .text(invoice.name, 50, 78, { align: 'right' });

      doc
        .roundedRect(50, 120, 245, 108, 10)
        .fillColor('#f8fafc')
        .fill();
      doc
        .roundedRect(50, 120, 245, 26, 10)
        .fillColor('#eef2ff')
        .fill();
      doc
        .fontSize(10)
        .fillColor('#6366f1')
        .text('BILLED FROM', 62, 128)
        .fontSize(12)
        .fillColor('#0f172a')
        .text(billedFromName, 62, 156)
        .fontSize(10)
        .fillColor('#334155')
        .text(billedFromEmail || 'N/A', 62, 176);

      doc
        .roundedRect(305, 120, 240, 108, 10)
        .fillColor('#f8fafc')
        .fill();
      doc
        .roundedRect(305, 120, 240, 26, 10)
        .fillColor('#eef2ff')
        .fill();
      doc
        .fontSize(10)
        .fillColor('#6366f1')
        .text('BILLED TO', 317, 128)
        .fontSize(12)
        .fillColor('#0f172a')
        .text(invoice.billedParty, 317, 156)
        .fontSize(10)
        .fillColor('#334155')
        .text(invoice.billedPartyEmail, 317, 176);

      const metaY = 248;
      doc
        .fontSize(9)
        .fillColor('#64748b')
        .text('Invoice Date', 50, metaY)
        .text('Due Date', 260, metaY);
      doc
        .fontSize(11)
        .fillColor('#0f172a')
        .text(formatDate(invoice.invoiceDate), 50, metaY + 14)
        .text(formatDate(invoice.dueDate), 260, metaY + 14);

      doc
        .moveTo(50, metaY + 40)
        .lineTo(545, metaY + 40)
        .lineWidth(1)
        .strokeColor('#e2e8f0')
        .stroke();

      const tableTop = 300;
      const colX = [50, 290, 355, 445];
      doc
        .rect(50, tableTop, 495, 24)
        .fillColor('#f1f5f9')
        .fill();
      doc
        .fontSize(10)
        .fillColor('#334155')
        .text('Description', colX[0] + 8, tableTop + 7)
        .text('Qty', colX[1] + 8, tableTop + 7)
        .text('Unit Price', colX[2] + 8, tableTop + 7)
        .text('Amount', colX[3] + 8, tableTop + 7);

      let y = tableTop + 24;
      invoice.lineItems.forEach((item) => {
        const amount = Number(item.quantity) * Number(item.unitPrice);
        doc
          .rect(50, y, 495, 24)
          .strokeColor('#e2e8f0')
          .stroke();
        doc
          .fontSize(10)
          .fillColor('#0f172a')
          .text(item.description, colX[0] + 8, y + 7, { width: 225, ellipsis: true })
          .text(String(item.quantity), colX[1] + 8, y + 7)
          .text(formatMoney(item.unitPrice, invoice.currency), colX[2] + 8, y + 7)
          .text(formatMoney(amount, invoice.currency), colX[3] + 8, y + 7);
        y += 24;
      });

      const totalsBoxY = y + 14;
      doc
        .roundedRect(330, totalsBoxY, 215, 62, 8)
        .fillColor('#f8fafc')
        .fill();
      doc
        .fontSize(10)
        .fillColor('#64748b')
        .text('Subtotal', 342, totalsBoxY + 12)
        .fillColor('#0f172a')
        .text(formatMoney(subtotal, invoice.currency), 480, totalsBoxY + 12, {
          width: 55,
          align: 'right',
        })
        .fillColor('#64748b')
        .text('Total Due', 342, totalsBoxY + 34)
        .fontSize(12)
        .fillColor('#0f172a')
        .text(formatMoney(total, invoice.currency), 455, totalsBoxY + 33, {
          width: 80,
          align: 'right',
        });

      doc
        .fontSize(9)
        .fillColor('#94a3b8')
        .text(`Generated by ${APP_NAME}`, 50, totalsBoxY + 82);

      if (invoice.note) {
        doc
          .fontSize(11)
          .fillColor('#334155')
          .text('Note', 50, totalsBoxY + 24)
          .fontSize(10)
          .fillColor('#475569')
          .text(invoice.note, 50, totalsBoxY + 41, { width: 255 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

export {
  buildInvoiceEmailTemplate,
  formatMoney,
  generateInvoicePdfBuffer,
  getInvoiceFilename,
  getInvoiceTotal,
};
