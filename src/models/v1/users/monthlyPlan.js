import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const incomeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    expenses: [expenseSchema],
    total_expenses: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/** A bucket is a named spending area (e.g. "Groceries", "Rent") within one monthly plan. */
const bucketSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    categories: [categorySchema],
    total_expenses: { type: Number, default: 0 },
    total_budget: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const monthlyPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    currency: { type: String, required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    description: { type: String, trim: true },
    /** All income for this calendar month — shared across every bucket. */
    incomes: [incomeSchema],
    buckets: [bucketSchema],
    total_expenses: { type: Number, default: 0 },
    total_income: { type: Number, default: 0 },
    /** Sum of category allocation limits across all buckets */
    total_budget: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    reportGenerated: { type: Boolean },
    /** Saved HTML from the one-time AI report (large; omit in list APIs). */
    reportHtml: { type: String },
    reportGeneratedAt: { type: Date },
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

monthlyPlanSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });

const MonthlyPlan = mongoose.model('MonthlyPlan', monthlyPlanSchema);
export default MonthlyPlan;
