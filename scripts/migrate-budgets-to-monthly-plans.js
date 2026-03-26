/**
 * One-time migration: legacy Budget documents → MonthlyPlan (shared income per month, buckets per old budget).
 * Run: node scripts/migrate-budgets-to-monthly-plans.js
 * Optional: node scripts/migrate-budgets-to-monthly-plans.js --delete-legacy
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Budget from '../src/models/v1/users/budget.js';
import MonthlyPlan from '../src/models/v1/users/monthlyPlan.js';
import { updateMonthlyPlanTotals } from '../src/utils/helper.js';

dotenv.config({ path: '.env' });

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startEndOfMonth(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected. Loading legacy budgets...');

  const budgets = await Budget.find({}).sort({ created_at: 1 });
  console.log(`Found ${budgets.length} budget(s).`);

  for (const b of budgets) {
    const d = new Date(b.start_date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const { start, end } = startEndOfMonth(year, month);

    let plan = await MonthlyPlan.findOne({
      user: b.user,
      year,
      month,
    });

    if (!plan) {
      plan = await MonthlyPlan.create({
        user: b.user,
        year,
        month,
        name: `${monthNames[month - 1]} ${year}`,
        currency: b.currency,
        start_date: start,
        end_date: end,
        description: b.description || '',
        incomes: [],
        buckets: [],
      });
      console.log(`Created plan ${plan._id} for ${year}-${month}`);
    }

    for (const inc of b.incomes || []) {
      plan.incomes.push({
        name: inc.name,
        amount: inc.amount,
        date: inc.date,
      });
    }

    const categories = (b.categories || []).map((c) => ({
      name: c.name,
      amount: c.amount,
      expenses: (c.expenses || []).map((e) => ({
        name: e.name,
        amount: e.amount,
        date: e.date,
      })),
      total_expenses: c.total_expenses || 0,
    }));

    plan.buckets.push({
      name: b.name || 'Main',
      description: b.description || '',
      categories,
    });

    await plan.save();
    await updateMonthlyPlanTotals(plan._id);
    console.log(`Merged budget "${b.name}" (${b._id}) into plan ${plan._id}`);
  }

  const deleteLegacy = process.argv.includes('--delete-legacy');
  if (deleteLegacy && budgets.length > 0) {
    const r = await Budget.deleteMany({});
    console.log(`Deleted ${r.deletedCount} legacy budget document(s).`);
  } else if (budgets.length > 0) {
    console.log(
      'Legacy Budget documents were NOT deleted. Re-run with --delete-legacy after verifying data.'
    );
  }

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
