import Budget from '../models/v1/users/budget.js';
import logger from './logger.js';
import User from './../models/v1/users/auth.js';

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
