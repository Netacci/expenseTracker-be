import Budget from '../models/v1/users/budget.js';
import MonthlyPlan from '../models/v1/users/monthlyPlan.js';
import logger from './logger.js';
import User from './../models/v1/users/auth.js';

/**
 * Recompute totals for a monthly plan (income is shared; expenses live under buckets).
 */
export const updateMonthlyPlanTotals = async (monthlyPlanId) => {
  try {
    const plan = await MonthlyPlan.findById(monthlyPlanId);
    if (!plan) {
      throw new Error('Monthly plan not found');
    }

    const totalIncome = plan.incomes.reduce(
      (acc, income) => acc + income.amount,
      0
    );

    let totalExpensesAll = 0;
    let totalAllocated = 0;

    plan.buckets.forEach((bucket) => {
      let bucketExpenses = 0;
      let bucketAllocated = 0;
      bucket.categories.forEach((category) => {
        const categoryTotalExpenses = category.expenses.reduce(
          (acc, expense) => acc + expense.amount,
          0
        );
        category.total_expenses = categoryTotalExpenses;
        bucketExpenses += categoryTotalExpenses;
        bucketAllocated += category.amount;
      });
      bucket.total_expenses = bucketExpenses;
      bucket.total_budget = bucketAllocated;
      bucket.balance = bucketAllocated - bucketExpenses;
      totalExpensesAll += bucketExpenses;
      totalAllocated += bucketAllocated;
    });

    plan.total_income = totalIncome;
    plan.total_expenses = totalExpensesAll;
    plan.total_budget = totalAllocated;
    plan.balance = totalIncome - totalExpensesAll;
    await plan.save();
  } catch (err) {
    logger.error('Error updating monthly plan totals:', err.message);
    throw new Error('Failed to update monthly plan totals');
  }
};

/**
 * Plain objects only — safe for JSON.stringify and Groq prompts (no Mongoose circular refs).
 */
export const getMonthlyPlanSpendingData = async (plan) => {
  const userId = plan.user.toString();
  const user = await User.findById(userId)
    .select('first_name last_name email')
    .lean();
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'User';

  const buckets = (plan.buckets || []).map((b) => ({
    name: b.name,
    total_expenses: b.total_expenses ?? 0,
    total_budget: b.total_budget ?? 0,
    categories: (b.categories || []).map((c) => ({
      name: c.name,
      amount: c.amount,
      total_expenses: c.total_expenses ?? 0,
      expenses: (c.expenses || []).map((e) => ({
        name: e.name,
        amount: e.amount,
        date: e.date,
      })),
    })),
  }));

  return {
    budgetData: {
      username: displayName,
      budgetName: plan.name,
      totalIncome: plan.total_income,
      totalExpenses: plan.total_expenses,
      buckets,
      incomes: (plan.incomes || []).map((i) => ({
        name: i.name,
        amount: i.amount,
        date: i.date,
      })),
      totalBudgetAmount: plan.total_budget,
      startDate: plan.start_date,
      endDate: plan.end_date,
      description: plan.description,
      currency: plan.currency,
    },
  };
};

export const updateTotals = async (budgetId) => {
  try {
    const budget = await Budget.findById(budgetId).populate(
      'categories incomes'
    );
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    const totalIncome = budget.incomes.reduce(
      (acc, income) => acc + income.amount,
      0
    );
    let totalExpenses = 0;
    budget.categories.forEach((category) => {
      const categoryTotalExpenses = category.expenses.reduce(
        (acc, expense) => acc + expense.amount,
        0
      );

      // Update total expenses for each category
      category.total_expenses = categoryTotalExpenses;

      // Add the category's total expenses to the overall totalExpenses for the budget
      totalExpenses += categoryTotalExpenses;
    });

    const totalBudgetAmount = budget.categories.reduce(
      (acc, category) => acc + category.amount,
      0
    );
    const balance = totalBudgetAmount - totalExpenses;
    // Update budget document with new totals
    budget.total_income = totalIncome;
    budget.total_expenses = totalExpenses;
    budget.total_budget = totalBudgetAmount;
    budget.balance = balance;
    await budget.save();
  } catch (err) {
    logger.error('Error updating totals:', err.message);
    throw new Error('Failed to update budget totals');
  }
};

export const getUserSpendingData = async (budget) => {
  const user = budget.user;
  const userId = user.toString();
  const username = await User.findById(userId);
  const budgetData = {
    username: username.first_name,
    budgetName: budget.name,
    totalIncome: budget.total_income,
    totalExpenses: budget.total_expenses,
    categories: budget.categories,
    incomes: budget.incomes,
    totalBudgetAmount: budget.total_budget,
    startDate: budget.start_date,
    endDate: budget.end_date,
    description: budget.description,
    currency: budget.currency,
  };

  return {
    budgetData,
  };
};
