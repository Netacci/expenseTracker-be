import mongoose from 'mongoose';
import MonthlyPlan from '../../../models/v1/users/monthlyPlan.js';
import {
  updateMonthlyPlanTotals,
  getMonthlyPlanSpendingData,
} from '../../../utils/helper.js';
import logger from '../../../utils/logger.js';
import { client } from '../../../utils/aIClient.js';
import { DEFAULT_CATEGORY_SEED } from '../../../constants/defaultCategories.js';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function startEndOfMonth(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Optional [{ name, amount }] from guided setup — deduped, max 24. */
function normalizePlanCategoriesFromBody(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out = [];
  const seen = new Set();
  for (const c of input.slice(0, 24)) {
    const name = String(c?.name ?? '')
      .trim()
      .slice(0, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    let amount = Number(c?.amount);
    if (Number.isNaN(amount) || amount < 0) amount = 0;
    out.push({ name, amount: Math.round(amount * 100) / 100 });
  }
  return out.length > 0 ? out : null;
}

const createMonthlyPlan = async (req, res) => {
  const { name, currency, year, month, description, categories: categoriesBody } =
    req.body;
  try {
    if (!currency || !year || !month) {
      return res
        .status(400)
        .json({ message: 'currency, year, and month are required' });
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (m < 1 || m > 12) {
      return res.status(400).json({ message: 'month must be 1–12' });
    }
    const existing = await MonthlyPlan.findOne({
      user: req.user._id,
      year: y,
      month: m,
    });
    if (existing) {
      return res.status(409).json({
        message: `You already have a plan for ${monthNames[m - 1]} ${y}. Open it to track spending.`,
      });
    }
    const { start, end } = startEndOfMonth(y, m);
    const planName =
      name?.trim() || `${monthNames[m - 1]} ${y}`;
    const categoriesDocs =
      normalizePlanCategoriesFromBody(categoriesBody) ??
      DEFAULT_CATEGORY_SEED.map((c) => ({ ...c }));
    const plan = await MonthlyPlan.create({
      name: planName,
      year: y,
      month: m,
      currency,
      start_date: start,
      end_date: end,
      description,
      user: req.user._id,
      buckets: [
        {
          name: 'Spending',
          description: '',
          categories: categoriesDocs,
        },
      ],
      incomes: [],
    });
    await updateMonthlyPlanTotals(plan._id);
    const created = await MonthlyPlan.findById(plan._id).select('-__v -reportHtml');
    const data = await attachHasSavedReport(created, plan._id, req.user._id);
    res.status(201).json({
      data,
      status: 201,
      message: 'Monthly plan created successfully',
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: 'A plan for this month already exists.',
      });
    }
    res.status(500).json({ message: err.message });
  }
};

async function attachHasSavedReport(planDoc, planId, userId) {
  const obj = planDoc.toObject ? planDoc.toObject() : planDoc;
  const hasSavedReport =
    (await MonthlyPlan.countDocuments({
      _id: planId,
      user: userId,
      reportGenerated: true,
      reportHtml: { $exists: true, $nin: [null, ''] },
    })) > 0;
  obj.hasSavedReport = hasSavedReport;
  return obj;
}

const getAllMonthlyPlans = async (req, res) => {
  try {
    const userId = req.user._id;
    const plans = await MonthlyPlan.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId.toString()) } },
      { $sort: { year: -1, month: -1 } },
      {
        $addFields: {
          hasSavedReport: {
            $and: [
              { $eq: ['$reportGenerated', true] },
              { $gt: [{ $strLenCP: { $ifNull: ['$reportHtml', ''] } }, 0] },
            ],
          },
        },
      },
      { $project: { reportHtml: 0, __v: 0 } },
    ]);
    res.status(200).json({ data: plans, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSingleMonthlyPlan = async (req, res) => {
  const { planId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({
      _id: planId,
      user: req.user._id,
    }).select('-__v -reportHtml');
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    // Legacy plans with no spending area: add a default so the app always has somewhere for categories.
    if (!plan.buckets?.length) {
      plan.buckets.push({
        name: 'Spending',
        description: '',
        categories: DEFAULT_CATEGORY_SEED.map((c) => ({ ...c })),
      });
      await plan.save();
      await updateMonthlyPlanTotals(plan._id);
      const migrated = await MonthlyPlan.findOne({
        _id: planId,
        user: req.user._id,
      }).select('-__v -reportHtml');
      const data = await attachHasSavedReport(migrated, planId, req.user._id);
      return res.status(200).json({ data, status: 200 });
    }
    const data = await attachHasSavedReport(plan, planId, req.user._id);
    res.status(200).json({ data, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editMonthlyPlan = async (req, res) => {
  const { name, currency, description } = req.body;
  const { planId } = req.params;
  try {
    const plan = await MonthlyPlan.findOneAndUpdate(
      { _id: planId, user: req.user._id },
      { name, currency, description },
      { new: true, select: '-reportHtml' }
    );
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const data = await attachHasSavedReport(plan, planId, req.user._id);
    res.status(200).json({ data, status: 200, message: 'Plan updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteMonthlyPlan = async (req, res) => {
  const { planId } = req.params;
  try {
    const result = await MonthlyPlan.findOneAndDelete({
      _id: planId,
      user: req.user._id,
    });
    if (!result) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    res.status(200).json({ message: 'Monthly plan deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ——— Incomes (plan-level) ———

const createIncome = async (req, res) => {
  const { name, amount, date } = req.body;
  const { planId } = req.params;
  try {
    if (!name || !amount || !date) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    plan.incomes.push({ name, amount, date });
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    const created = plan.incomes[plan.incomes.length - 1];
    res.status(201).json({
      data: created,
      status: 201,
      message: 'Income created successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllIncomes = async (req, res) => {
  const { planId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    res.status(200).json({ data: plan.incomes, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editIncome = async (req, res) => {
  const { name, amount, date } = req.body;
  const { planId, income_id } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const inc = plan.incomes.id(income_id);
    if (!inc) {
      return res.status(404).json({ message: 'Income not found' });
    }
    inc.name = name;
    inc.amount = amount;
    inc.date = date;
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({
      data: inc,
      status: 200,
      message: 'Income updated successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteIncome = async (req, res) => {
  const { planId, income_id } = req.params;
  try {
    const plan = await MonthlyPlan.findOneAndUpdate(
      { _id: planId, user: req.user._id },
      { $pull: { incomes: { _id: income_id } } },
      { new: true }
    );
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({ message: 'Income deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ——— Buckets ———

const createBucket = async (req, res) => {
  const { name, description } = req.body;
  const { planId } = req.params;
  try {
    if (!name) {
      return res.status(400).json({ message: 'Bucket name is required' });
    }
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    plan.buckets.push({ name, description: description || '', categories: [] });
    await plan.save();
    const bucket = plan.buckets[plan.buckets.length - 1];
    await updateMonthlyPlanTotals(planId);
    res.status(201).json({
      data: bucket,
      status: 201,
      message: 'Bucket created successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBuckets = async (req, res) => {
  const { planId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    res.status(200).json({ data: plan.buckets, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSingleBucket = async (req, res) => {
  const { planId, bucketId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    res.status(200).json({ data: bucket, status: 200, planMeta: {
      currency: plan.currency,
      start_date: plan.start_date,
      end_date: plan.end_date,
      plan_name: plan.name,
      plan_id: plan._id,
    }});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editBucket = async (req, res) => {
  const { name, description } = req.body;
  const { planId, bucketId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    if (name !== undefined) bucket.name = name;
    if (description !== undefined) bucket.description = description;
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({ data: bucket, status: 200, message: 'Bucket updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteBucket = async (req, res) => {
  const { planId, bucketId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    if (plan.buckets.length <= 1) {
      return res.status(400).json({
        message: 'Keep at least one spending area in this plan.',
      });
    }
    plan.buckets.pull({ _id: bucketId });
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({ message: 'Bucket deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ——— Categories (under bucket) ———

const createCategory = async (req, res) => {
  const { name, amount } = req.body;
  const { planId, bucketId } = req.params;
  try {
    if (!name || amount === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    bucket.categories.push({ name, amount });
    await plan.save();
    const category = bucket.categories[bucket.categories.length - 1];
    await updateMonthlyPlanTotals(planId);
    res.status(201).json({
      data: category,
      status: 201,
      message: 'Category created successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllCategories = async (req, res) => {
  const { planId, bucketId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    res.status(200).json({ data: bucket.categories, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editCategory = async (req, res) => {
  const { name, amount } = req.body;
  const { planId, bucketId, category_id } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    const category = bucket.categories.id(category_id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    category.name = name;
    category.amount = amount;
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({
      data: category,
      status: 200,
      message: 'Category updated successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteCategory = async (req, res) => {
  const { planId, bucketId, category_id } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    bucket.categories.pull({ _id: category_id });
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({ message: 'Category deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ——— Expenses ———

const createExpense = async (req, res) => {
  const { name, amount, date } = req.body;
  const { planId, bucketId, category_id } = req.params;
  try {
    if (!name || !amount || !date) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    const category = bucket.categories.id(category_id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    category.expenses.push({ name, amount, date });
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    const expense = category.expenses[category.expenses.length - 1];
    res.status(201).json({
      data: expense,
      status: 201,
      message: 'Expense created successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllExpenses = async (req, res) => {
  const { planId, bucketId, category_id } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    const category = bucket.categories.id(category_id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ data: category.expenses, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editExpense = async (req, res) => {
  const { name, amount, date } = req.body;
  const { planId, bucketId, category_id, expense_id } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    const category = bucket.categories.id(category_id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    const expense = category.expenses.id(expense_id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    expense.name = name;
    expense.amount = amount;
    expense.date = date;
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({
      data: expense,
      status: 200,
      message: 'Expense updated successfully',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteExpense = async (req, res) => {
  const { planId, bucketId, category_id, expense_id } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const bucket = plan.buckets.id(bucketId);
    if (!bucket) {
      return res.status(404).json({ message: 'Bucket not found' });
    }
    const category = bucket.categories.id(category_id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    category.expenses.pull({ _id: expense_id });
    await plan.save();
    await updateMonthlyPlanTotals(planId);
    res.status(200).json({ message: 'Expense deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getRecentExpenses = async (req, res) => {
  const { planId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    const recentExpenses = [];
    plan.buckets.forEach((bucket) => {
      bucket.categories.forEach((category) => {
        category.expenses.slice(-3).forEach((expense) => {
          recentExpenses.push({
            ...expense.toObject(),
            categoryName: category.name,
            bucketName: bucket.name,
            bucketId: bucket._id,
          });
        });
      });
    });
    res.status(200).json({ data: recentExpenses, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function groqErrorMessage(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const fromBody =
    err.response?.data?.error?.message ||
    err.response?.data?.message ||
    err.body?.error?.message;
  if (fromBody) return String(fromBody);
  if (err.error?.message) return err.error.message;
  if (err.message) return err.message;
  try {
    return JSON.stringify(err.error || err);
  } catch {
    return 'Request to AI provider failed';
  }
}

const generateReport = async (req, res) => {
  const { planId } = req.params;
  try {
    if (!process.env.GROQ_API_KEY?.trim()) {
      return res.status(503).json({
        message:
          'Report generation is not configured: set GROQ_API_KEY in the server environment.',
      });
    }

    const plan = await MonthlyPlan.findOne({
      _id: planId,
      user: req.user._id,
    }).select('-__v');
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    if (plan.reportGenerated === true && plan.reportHtml) {
      return res.status(409).json({
        message:
          'A report has already been generated for this plan. View it from Tabs or the plan page.',
      });
    }
    const { budgetData } = await getMonthlyPlanSpendingData(plan);
    const model =
      process.env.GROQ_REPORT_MODEL?.trim() || 'llama-3.3-70b-versatile';
    const prompt = `Analyze the following spending data for ${
      budgetData.username
    } and generate a personalized DETAILED report in HTML format. The report should include, in this order and headings, and should be in the same format for all generated reports:
    - An overview of spending habits, trends, and patterns.
    - Specific insights based on spending behavior.
    - Personalized recommendations on how to improve financial habits.
    
    Please ensure the report is:
    1. Clean and properly formatted in HTML with appropriate headings and bullet points.
    2. Styled consistently using inline CSS where necessary.
    3. Free of any variables, functions, dynamic placeholders (e.g., category.get('name')), or tables.
    4. Only return plain text content properly formatted in HTML, ensuring correct spacing and indentation.
    
    ### IMPORTANT INSTRUCTIONS:
    - Address the user directly and avoid third-person references.
    - Do not include any formal closings (e.g., "Best regards").
    - For any styling, use the following convention:
      - Use the shade of green - #16a34a.
      - Use <strong> for bold text instead of **.
      - Use <ul> and <li> for lists instead of *.
      - Don't use ** or *.
      - It should be PROPERLY FORMATTED and SPACED.
      - HEADERS SHOULD ALWAYS BE BOLD and with a color.
      - LISTS/li elements SHOULD ALWAYS HAVE A BULLET OR NUMBER.
      - There should be proper spacing to differentiate paragraphs and sections.
      - There should be proper line spacing of 1.5.
      - li element should always have a list-style CSS property with a value of "disc".

      - Always use this format for all generated reports. 
      <div id="pdfContent">
 <div id="watermark" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); 
  font-size: 100px; color: rgba(0, 0, 0, 0.1); pointer-events: none; white-space: nowrap;">
  ExpenseTracker
</div>
      <style>
  body {
    font-family: Arial, sans-serif;
    line-height: 1.5;
    margin: 20px; 
  }
  h1, h2, h3, h4, h5, h6 {
    color: #16a34a;
    font-weight: bold;
    margin-bottom: 15px; 
  }
  p {
    margin-bottom: 10px;
  }
  ul {
    list-style-type: disc; 
      list-style-position: inside;
    margin-left: 20px; 
    margin-bottom: 15px;
  }
  li {
    margin-bottom: 5px; 
    line-height: 1.5;
  }
</style>
 <h1>Expense Report for ${budgetData.username}</h1>
   <div>Let all the generated content be wrapped here</div>
   </div>
    
    Make sure to strictly follow these guidelines in every generated report, and the report should be VERY DETAILED.


    
    Here is the user's spending data: \n\n${JSON.stringify(budgetData)}`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a financial assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      logger.error('generateReport: empty model response', {
        choices: response.choices?.length,
      });
      return res.status(502).json({
        message:
          'The AI returned an empty report. Try again or use a different GROQ_REPORT_MODEL.',
      });
    }

    plan.reportHtml = content;
    plan.reportGenerated = true;
    plan.reportGeneratedAt = new Date();
    await plan.save();
    res.status(200).json({ report: content });
  } catch (err) {
    const detail = groqErrorMessage(err);
    logger.error('Error generating report:', detail, err?.stack || '');
    const low = detail.toLowerCase();
    const status =
      err?.status === 401 ||
      err?.statusCode === 401 ||
      low.includes('invalid api key') ||
      low.includes('incorrect api key')
        ? 503
        : 500;
    res.status(status).json({
      message:
        status === 503
          ? 'Groq API key is missing or invalid. Set GROQ_API_KEY in .env.'
          : `Failed to generate report: ${detail}`,
    });
  }
};

/** Return saved HTML for a plan (one report per plan). */
const getSavedReport = async (req, res) => {
  const { planId } = req.params;
  try {
    const plan = await MonthlyPlan.findOne({
      _id: planId,
      user: req.user._id,
    }).select('name reportHtml reportGenerated reportGeneratedAt');
    if (!plan) {
      return res.status(404).json({ message: 'Monthly plan not found' });
    }
    if (!plan.reportGenerated || !plan.reportHtml) {
      return res.status(404).json({
        message: 'No saved report for this plan yet.',
      });
    }
    res.status(200).json({
      data: {
        html: plan.reportHtml,
        generatedAt: plan.reportGeneratedAt,
        planName: plan.name,
      },
      status: 200,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export {
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
};
