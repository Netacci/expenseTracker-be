import Budget from '../../../models/v1/users/budget.js';
import { getUserSpendingData, updateTotals } from '../../../utils/helper.js';
import logger from '../../../utils/logger.js';
import { client } from '../../../utils/aIClient.js';

const createBudget = async (req, res) => {
  const { name, currency, start_date, end_date, description } = req.body;

  try {
    if (!name || !currency || !start_date || !end_date) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const budget = await Budget.create({
      name,
      currency,
      start_date,
      end_date,
      description,
      user: req.user._id,
    });

    res.status(201).json({
      data: budget,
      status: 201,
      message: 'Budget created successfullys',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getAllBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find({ user: req.user._id }).select('-__v');
    res.status(200).json({ data: budgets, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getSingleBudget = async (req, res) => {
  const { id } = req.params;
  try {
    const budget = await Budget.findById({
      _id: id,
      user: req.user._id,
    }).select(' -__v');

    res.status(200).json({ data: budget, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const editBudget = async (req, res) => {
  const { name, amount, currency, start_date, end_date, description } =
    req.body;
  const { id } = req.params;
  try {
    const budget = await Budget.findByIdAndUpdate(
      { _id: id, user: req.user._id },
      { name, amount, currency, start_date, end_date, description },
      { new: true }
    );
    res
      .status(200)
      .json({ data: budget, status: 200, message: 'Budget updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const deleteBudget = async (req, res) => {
  const { id } = req.params;
  try {
    await Budget.findByIdAndDelete({ _id: id, user: req.user._id });
    res
      .status(200)
      .json({ message: 'Budget deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const createIncome = async (req, res) => {
  const { name, amount, date } = req.body;
  const { id } = req.params;
  try {
    if (!name || !amount || !date) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const budget = await Budget.findById(id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    const income = {
      name,
      amount,
      date,
    };
    budget.incomes.push(income);
    await budget.save();
    await updateTotals(id);
    res.status(201).json({
      data: income,
      status: 201,
      message: 'Income created successfullys',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getAllIncomes = async (req, res) => {
  const { id } = req.params;

  try {
    const budget = await Budget.findById(id).populate('incomes');
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    res.status(200).json({ data: budget.incomes, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const editIncome = async (req, res) => {
  const { name, amount, date } = req.body;
  const { id, income_id } = req.params;
  try {
    const income = await Budget.findOneAndUpdate(
      { _id: id, 'incomes._id': income_id },
      {
        $set: {
          'incomes.$.name': name,
          'incomes.$.amount': amount,
          'incomes.$.date': date,
        },
      },
      { new: true }
    );
    if (!income) {
      return res.status(404).json({ message: 'Income not found' });
    }

    await updateTotals(id);
    res.status(200).json({
      data: income,
      status: 201,
      message: 'Income updated successfullys',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const deleteIncome = async (req, res) => {
  const { id, income_id } = req.params;

  try {
    const income = await Budget.findByIdAndUpdate(id, {
      $pull: { incomes: { _id: income_id } },
    });
    if (!income) {
      return res.status(404).json({ message: 'Income not found' });
    }

    await updateTotals(id);

    res
      .status(200)
      .json({ message: 'Income deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const createCategory = async (req, res) => {
  const { name, amount } = req.body;
  const { id } = req.params;
  try {
    if (!name || !amount) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const budget = await Budget.findById(id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    const category = {
      name,
      amount,
    };
    budget.categories.push(category);
    await budget.save();
    await updateTotals(id);
    res.status(201).json({
      data: category,
      status: 201,
      message: 'Category created successfullys',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getAllCategories = async (req, res) => {
  const { id } = req.params;
  try {
    const budget = await Budget.findById(id).populate('categories');
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    res.status(200).json({ data: budget.categories, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const editCategory = async (req, res) => {
  const { name, amount } = req.body;
  const { id, category_id } = req.params;
  try {
    const category = await Budget.findOneAndUpdate(
      { _id: id, 'categories._id': category_id },
      {
        $set: {
          'categories.$.name': name,
          'categories.$.amount': amount,
        },
      },
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await updateTotals(id);
    res.status(200).json({
      data: category,
      status: 201,
      message: 'Category updated successfullys',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const deleteCategory = async (req, res) => {
  const { id, category_id } = req.params;

  try {
    const category = await Budget.findByIdAndUpdate(id, {
      $pull: { categories: { _id: category_id } },
    });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await updateTotals(id);

    res
      .status(200)
      .json({ message: 'Category deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const createExpense = async (req, res) => {
  const { name, amount, date } = req.body;
  const { id, category_id } = req.params;
  try {
    if (!name || !amount || !date) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const budget = await Budget.findById(id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    const category = budget.categories.id(category_id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const expense = {
      name,
      amount,
      date,
    };
    category.expenses.push(expense);
    await budget.save();
    await updateTotals(id);
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
  const { id, category_id } = req.params;
  try {
    const budget = await Budget.findById(id).populate('categories');
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    const category = budget.categories.id(category_id);
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
  const { id, category_id, expense_id } = req.params;
  try {
    const expense = await Budget.findOneAndUpdate(
      {
        _id: id,
        'categories._id': category_id,
        'categories.expenses._id': expense_id,
      },
      {
        $set: {
          'categories.$[category].expenses.$[expense].name': name,
          'categories.$[category].expenses.$[expense].amount': amount,
          'categories.$[category].expenses.$[expense].date': date,
        },
      },
      {
        arrayFilters: [
          { 'category._id': category_id },
          { 'expense._id': expense_id },
        ],
        new: true,
      }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    await updateTotals(id);
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
  const { id, category_id, expense_id } = req.params;
  try {
    const expense = await Budget.findOneAndUpdate(
      { _id: id, 'categories._id': category_id },
      {
        $pull: {
          'categories.$.expenses': { _id: expense_id },
        },
      },
      {
        new: true,
      }
    );
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    await updateTotals(id);
    res
      .status(200)
      .json({ message: 'Expense deleted successfully', status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getRecentExpenses = async (req, res) => {
  const { id } = req.params;
  try {
    const budget = await Budget.findById(id).populate('categories');
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    // const recentExpenses = budget.categories
    //   .map((category) => category.expenses.slice(-3))
    //   .flat();
    const recentExpenses = budget.categories
      .map((category) =>
        category.expenses.slice(-3).map((expense) => ({
          ...expense.toObject(),
          categoryName: category.name,
        }))
      )
      .flat();
    res.status(200).json({ data: recentExpenses, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generateReport = async (req, res) => {
  const { id } = req.params;
  try {
    const budget = await Budget.findById({
      _id: id,
      user: req.user._id,
    }).select(' -__v');
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    const budgetData = await getUserSpendingData(budget);

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
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: 'You are a financial assistant.' },
        { role: 'user', content: prompt },
      ],
    });

    budget.reportGenerated = true;
    await budget.save();
    res.status(200).json({ report: response.choices[0].message.content });
  } catch (err) {
    console.log(err);
    logger.error('Error generating report:', err.message);
    res.status(500).json({ message: 'Failed to generate report' });
  }
};
export {
  createBudget,
  getSingleBudget,
  getAllBudgets,
  editBudget,
  deleteBudget,
  createIncome,
  createCategory,
  createExpense,
  getAllIncomes,
  getAllCategories,
  editIncome,
  deleteIncome,
  editCategory,
  deleteCategory,
  getAllExpenses,
  editExpense,
  deleteExpense,
  getRecentExpenses,
  generateReport,
};
