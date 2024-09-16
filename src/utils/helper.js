import Budget from '../models/v1/users/budget.js';

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
    console.error('Error updating totals:', err.message);
    throw new Error('Failed to update budget totals');
  }
};
