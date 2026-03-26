import { Router } from 'express';
import authenticate from '../../../middlewares/authenticate.js';
import {
  createMonthlyPlan,
  getAllMonthlyPlans,
  getSingleMonthlyPlan,
  editMonthlyPlan,
  deleteMonthlyPlan,
  createIncome,
  getAllIncomes,
  editIncome,
  deleteIncome,
  createBucket,
  getBuckets,
  getSingleBucket,
  editBucket,
  deleteBucket,
  createCategory,
  getAllCategories,
  editCategory,
  deleteCategory,
  createExpense,
  getAllExpenses,
  editExpense,
  deleteExpense,
  getRecentExpenses,
  generateReport,
  getSavedReport,
} from '../../../controller/v1/users/monthlyPlan.js';

const router = Router();

router.post('/create', authenticate('user'), createMonthlyPlan);
router.get('/', authenticate('user'), getAllMonthlyPlans);

router.post('/:planId/incomes/create', authenticate('user'), createIncome);
router.get('/:planId/incomes', authenticate('user'), getAllIncomes);
router.put('/:planId/incomes/:income_id', authenticate('user'), editIncome);
router.delete('/:planId/incomes/:income_id', authenticate('user'), deleteIncome);

router.post('/:planId/buckets/create', authenticate('user'), createBucket);
router.get('/:planId/buckets', authenticate('user'), getBuckets);
router.get('/:planId/buckets/:bucketId', authenticate('user'), getSingleBucket);
router.put('/:planId/buckets/:bucketId', authenticate('user'), editBucket);
router.delete('/:planId/buckets/:bucketId', authenticate('user'), deleteBucket);

router.post(
  '/:planId/buckets/:bucketId/category/create',
  authenticate('user'),
  createCategory
);
router.get(
  '/:planId/buckets/:bucketId/categories',
  authenticate('user'),
  getAllCategories
);
router.put(
  '/:planId/buckets/:bucketId/categories/:category_id',
  authenticate('user'),
  editCategory
);
router.delete(
  '/:planId/buckets/:bucketId/categories/:category_id',
  authenticate('user'),
  deleteCategory
);

router.post(
  '/:planId/buckets/:bucketId/categories/:category_id/expense/create',
  authenticate('user'),
  createExpense
);
router.get(
  '/:planId/buckets/:bucketId/categories/:category_id/expenses',
  authenticate('user'),
  getAllExpenses
);
router.put(
  '/:planId/buckets/:bucketId/categories/:category_id/expenses/:expense_id',
  authenticate('user'),
  editExpense
);
router.delete(
  '/:planId/buckets/:bucketId/categories/:category_id/expenses/:expense_id',
  authenticate('user'),
  deleteExpense
);

router.get('/:planId/recent-expenses', authenticate('user'), getRecentExpenses);
router.post('/:planId/generate-report', authenticate('user'), generateReport);
router.get('/:planId/report', authenticate('user'), getSavedReport);

router.get('/:planId', authenticate('user'), getSingleMonthlyPlan);
router.put('/:planId', authenticate('user'), editMonthlyPlan);
router.delete('/:planId', authenticate('user'), deleteMonthlyPlan);

export default router;
