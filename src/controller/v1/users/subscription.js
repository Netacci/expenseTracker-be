import Subscription from '../../../models/v1/users/subscription.js';

const createSubscription = async (req, res) => {
  const { service_name, amount, currency, billing_cycle, next_charge_date, notes, status } =
    req.body;
  try {
    if (!service_name?.trim()) {
      return res.status(400).json({ message: 'Service name is required' });
    }
    if (amount === undefined || Number.isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ message: 'Amount must be a valid number' });
    }
    if (billing_cycle && !['monthly', 'yearly'].includes(billing_cycle)) {
      return res
        .status(400)
        .json({ message: 'Billing cycle must be monthly or yearly' });
    }
    if (status && !['active', 'paused', 'cancelled'].includes(status)) {
      return res
        .status(400)
        .json({ message: 'Status must be active, paused, or cancelled' });
    }

    const created = await Subscription.create({
      user: req.user._id,
      service_name: service_name.trim(),
      amount: Number(amount),
      currency: currency || 'USD',
      billing_cycle: billing_cycle || 'monthly',
      next_charge_date: next_charge_date || undefined,
      notes: notes || '',
      status: status || 'active',
    });
    res.status(201).json({
      data: created,
      status: 201,
      message: 'Subscription created successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user._id }).sort({
      created_at: -1,
    });
    res.status(200).json({ data: subscriptions, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editSubscription = async (req, res) => {
  const { subscription_id } = req.params;
  const { service_name, amount, currency, billing_cycle, next_charge_date, notes, status } =
    req.body;
  try {
    const updates = {};
    if (service_name !== undefined) {
      if (!service_name.trim()) {
        return res.status(400).json({ message: 'Service name is required' });
      }
      updates.service_name = service_name.trim();
    }
    if (amount !== undefined) {
      if (Number.isNaN(Number(amount)) || Number(amount) < 0) {
        return res.status(400).json({ message: 'Amount must be a valid number' });
      }
      updates.amount = Number(amount);
    }
    if (currency !== undefined) updates.currency = currency || 'USD';
    if (billing_cycle !== undefined) {
      if (!['monthly', 'yearly'].includes(billing_cycle)) {
        return res
          .status(400)
          .json({ message: 'Billing cycle must be monthly or yearly' });
      }
      updates.billing_cycle = billing_cycle;
    }
    if (status !== undefined) {
      if (!['active', 'paused', 'cancelled'].includes(status)) {
        return res
          .status(400)
          .json({ message: 'Status must be active, paused, or cancelled' });
      }
      updates.status = status;
    }
    if (next_charge_date !== undefined) {
      updates.next_charge_date = next_charge_date || null;
    }
    if (notes !== undefined) updates.notes = notes;

    const updated = await Subscription.findOneAndUpdate(
      { _id: subscription_id, user: req.user._id },
      updates,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.status(200).json({
      data: updated,
      status: 200,
      message: 'Subscription updated successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSubscription = async (req, res) => {
  const { subscription_id } = req.params;
  try {
    const deleted = await Subscription.findOneAndDelete({
      _id: subscription_id,
      user: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.status(200).json({ message: 'Subscription deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export {
  createSubscription,
  getAllSubscriptions,
  editSubscription,
  deleteSubscription,
};
