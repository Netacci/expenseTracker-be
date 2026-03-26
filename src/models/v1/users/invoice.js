import mongoose from 'mongoose';

const invoiceLineItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
  }
);

const invoiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    billedParty: {
      type: String,
      required: true,
      trim: true,
    },
    billedPartyEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      trim: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
    },
    note: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid'],
      default: 'draft',
    },
    sentAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    paymentLink: {
      monthlyPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MonthlyPlan',
      },
      incomeId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    lineItems: {
      type: [invoiceLineItemSchema],
      default: [],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
