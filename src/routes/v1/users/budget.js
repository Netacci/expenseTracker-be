import { Router } from 'express';
import authenticate from '../../../middlewares/authenticate.js';
import {
  createBudget,
  createCategory,
  createExpense,
  createIncome,
  deleteBudget,
  deleteCategory,
  deleteExpense,
  deleteIncome,
  editBudget,
  editCategory,
  editExpense,
  editIncome,
  getAllBudgets,
  getAllCategories,
  getAllExpenses,
  getAllIncomes,
  getSingleBudget,
} from '../../../controller/v1/users/budget.js';

const router = Router();
router.post('/create', authenticate('user'), createBudget);
router.get('/', authenticate('user'), getAllBudgets);
router.get('/:id', authenticate('user'), getSingleBudget);
router.put('/:id', authenticate('user'), editBudget);
router.delete('/:id', authenticate('user'), deleteBudget);
router.post('/:id/income/create', authenticate('user'), createIncome);
router.get('/:id/incomes', authenticate('user'), getAllIncomes);
router.put('/:id/incomes/:income_id', authenticate('user'), editIncome);
router.delete('/:id/incomes/:income_id', authenticate('user'), deleteIncome);
router.post('/:id/category/create', authenticate('user'), createCategory);
router.get('/:id/categories', authenticate('user'), getAllCategories);
router.put('/:id/categories/:category_id', authenticate('user'), editCategory);
router.delete(
  '/:id/categories/:category_id',
  authenticate('user'),
  deleteCategory
);
router.post(
  '/:id/categories/:category_id/expense/create',
  authenticate('user'),
  createExpense
);
router.get(
  '/:id/categories/:category_id/expenses',
  authenticate('user'),
  getAllExpenses
);
router.put(
  '/:id/categories/:category_id/expenses/:expense_id',
  authenticate('user'),
  editExpense
);
router.delete(
  '/:id/categories/:category_id/expenses/:expense_id',
  authenticate('user'),
  deleteExpense
);
export default router;
