import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    service_name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, default: 'USD' },
    billing_cycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    next_charge_date: { type: Date },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled'],
      default: 'active',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

subscriptionSchema.index({ user: 1, service_name: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
