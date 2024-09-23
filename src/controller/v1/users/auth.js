import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../../models/v1/users/auth.js';
// import { sendEmail } from '../../../utils/emails.js';
import validator from 'validator';
import { body } from 'express-validator';
import logger from '../../../utils/logger.js';
import { sendEmails } from '../../../utils/resend.js';

const register = async (req, res) => {
  await body('email').isEmail().normalizeEmail().run(req);
  await body('first_name').escape().trim().run(req);
  const { email, password, first_name } = req.body;
  try {
    if (!email || !password || !first_name) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    if (!validator.isStrongPassword(password)) {
      return res.status(400).json({
        message: `Weak password: ${password}. Your password must include lowercase, uppercase, digits, symbols and must be at least 8 characters`,
      });
    }
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: '30m',
    });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      verificationToken,
      is_email_verified: false,
      first_name,
      verificationToken,
    });
    await user.save();
    const hostlink =
      process.env.NODE_ENV === 'production'
        ? 'https://expense-tracker-netaccis-projects.vercel.app'
        : 'http://localhost:5173';
    const link = `${hostlink}/email/confirm/${verificationToken}/${email}`;
    const subject = 'Verify Your ExpenseTracker Account';
    const actionText = 'Verify Email';

    const html = `
      <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='font-size: 24px; font-weight: bold; color: #16a34a; margin-bottom: 20px;'>
          ExpenseTracker
        </div>

        <p>Hello ${user.first_name},</p>

        <p>To get started and ensure the security of your account, please verify your email address by clicking the button below:</p>

        <a
          href=${link}
          style='display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px;'
        >
          ${actionText}
        </a>
        <p>
         This link will expire in 30mins for security reasons. If you don't verify your email within this time, you may need to request a new verification link.
        </p>
        <p>
        If you didn't create an account with ExpenseTracker, please ignore this email or contact our support team if you have any concerns.
        </p>
      <p>
      We're looking forward to helping you manage your expenses more effectively!
        </p>
        <div style='margin-top: 30px; font-size: 12px; color: #666;'>
          <p>© 2024 ExpenseTracker. All rights reserved.</p>
          <p>123 Finance Street, Money City, MC 12345</p>
        </div>
      </body>
    `;
    await sendEmails(subject, user.email, html);

    res.status(201).json({
      message: 'User registered successfully',
      token: verificationToken,
      status: 201,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const verifyEmail = async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.is_email_verified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    if (token !== user.verificationToken) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    user.is_email_verified = true;
    user.verificationToken = undefined;
    await user.save();
    const loginToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const hostlink =
      process.env.NODE_ENV === 'production'
        ? 'https://expense-tracker-netaccis-projects.vercel.app'
        : 'http://localhost:5173';
    const link = `${hostlink}/login`;
    const subject = 'Welcome to ExpenseTracker!';
    const actionText = 'Log In To Account';

    const html = `
      <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='font-size: 24px; font-weight: bold; color: #16a34a; margin-bottom: 20px;'>
          ExpenseTracker
        </div>

        <p>Welcome to ExpenseTracker, ${user.first_name}!</p>
        <p>We're thrilled to have you on board. You've taken the first step towards better financial management, and we're here to support you every step of the way.</p>
  
        <p>Here's how you can get started:</p>
        <ul><li> Set up your account: Complete your profile and personalize your settings.</li><li> Create an expense category and set a budget</li><li> Add your first expense: Start tracking your spending right away.</li><li>  Explore our features: Discover budgeting tools, reports, and more.</li></ul>

        <a
          href=${link}
          style='display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px;'
        >
          ${actionText}
        </a>
        <p>
       If you have any questions or need assistance, our support team is always here to help. Just reply to this email or visit our support center.

        </p>
        <p>
      We're excited to be part of your journey towards financial wellness!
        </p>
      <p>
      Best regards,The ExpenseTracker Team
        </p>
        <div style='margin-top: 30px; font-size: 12px; color: #666;'>
          <p>© 2024 ExpenseTracker. All rights reserved.</p>
          <p>123 Finance Street, Money City, MC 12345</p>
        </div>
      </body>
    `;
    await sendEmails(subject, user.email, html);

    res.status(201).json({
      data: user,
      token: loginToken,
      message: 'Email verified successfully',
      status: 201,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: 500 });
  }
};
const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.is_email_verified) {
    return res.status(400).json({ message: 'Email already verified' });
  }

  // Generate a new verification token
  const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: '30m',
  });

  user.verificationToken = verificationToken;
  await user.save();

  // Send the email
  const hostlink =
    process.env.NODE_ENV === 'production'
      ? 'https://expense-tracker-netaccis-projects.vercel.app'
      : 'http://localhost:5173';
  const link = `${hostlink}/email/confirm/${verificationToken}/${email}`;
  const subject = 'Verify Your ExpenseTracker Account';
  const actionText = 'Verify Email';

  const html = `
      <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='font-size: 24px; font-weight: bold; color: #16a34a; margin-bottom: 20px;'>
          ExpenseTracker
        </div>

        <p>Hello ${user.first_name},</p>
  
        <p>We receieved a request for another verification link. To ensure you have full access to all ExpenseTracker features and to keep your account secure, please verify your email by clicking the button below:</p>

        <a
          href=${link}
          style='display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px;'
        >
          ${actionText}
        </a>
        <p>
        This new verification link will expire in 30mins for security reasons. If you don't verify your email within this time, you may need to request another verification link from your account settings.
        </p>
        <p>
        If you didn't create an account with ExpenseTracker, please ignore this email or contact our support team if you have any concerns.
        </p>
      <p>
      We're looking forward to helping you manage your expenses more effectively!
        </p>
        <div style='margin-top: 30px; font-size: 12px; color: #666;'>
          <p>© 2024 ExpenseTracker. All rights reserved.</p>
          <p>123 Finance Street, Money City, MC 12345</p>
        </div>
      </body>
    `;
  await sendEmails(subject, user.email, html);
  res.status(200).json({ message: 'Verification email resent' });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: 'Email or password is incorrect' });
    }
    if (!user.is_email_verified) {
      return res.status(401).json({ message: 'Verify your email' });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      logger.warn(`User with ${email} provided the wrong password ${password}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d',
      }
    );

    res.status(200).json({ token, status: 200 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: 'Email sent to user' });
    }
    if (!user.is_email_verified) {
      return res.status(400).json({ message: 'Email not verified' });
    }
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: '30m',
    });
    user.verificationToken = token;
    const hostlink =
      process.env.NODE_ENV === 'production'
        ? 'https://expense-tracker-netaccis-projects.vercel.app'
        : 'http://localhost:5173';

    const link = `${hostlink}/reset-password/${token}`;
    const subject = 'Reset Your ExpenseTracker Password';
    const actionText = 'Reset Password';

    const html = `
        <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
          <div style='font-size: 24px; font-weight: bold; color: #16a34a; margin-bottom: 20px;'>
            ExpenseTracker
          </div>
  
          <p>Hello ${user.first_name},</p>
    
          <p>We received a request to reset the password for your ExpenseTracker account.</p>
          <p>If you made this request, please click the button below to set a new password:</p>
  
          <a
            href=${link}
            style='display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px;'
          >
            ${actionText}
          </a>
          <p>
       This password reset link will expire in 30mins for security reasons. If you need a new reset link, you can request one from our login page.
          </p>
          <p>
        If you didn't request a password reset, please ignore this email. Your account remains secure, and no changes have been made.

          </p>
        <p>
       For any questions or concerns, please don't hesitate to contact our support team.
          </p>
          <div style='margin-top: 30px; font-size: 12px; color: #666;'>
            <p>© 2024 ExpenseTracker. All rights reserved.</p>
            <p>123 Finance Street, Money City, MC 12345</p>
          </div>
        </body>
      `;
    await user.save();
    await sendEmails(subject, user.email, html);

    res.status(200).json({
      message: 'Password reset link sent to your email',
      token,
      status: 200,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const resetPassword = async (req, res) => {
  const { password, token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!validator.isStrongPassword(password)) {
      return res.status(400).json({
        message: `Weak password: ${password}. Your password must include lowercase, uppercase, digits, symbols and must be at least 8 characters`,
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.verificationToken = undefined;

    const subject = 'Your ExpenseTracker Password Has Been Reset';
    const actionText = 'Log In to My Account';
    const hostlink =
      process.env.NODE_ENV === 'production'
        ? 'https://expense-tracker-netaccis-projects.vercel.app'
        : 'http://localhost:5173';

    const link = `${hostlink}/login`;
    const html = `
      <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='font-size: 24px; font-weight: bold; color: #16a34a; margin-bottom: 20px;'>
          ExpenseTracker
        </div>
  
        <p>This email confirms that the password for your ExpenseTracker account has been successfully reset.</p>
        <p>You can now log in to your account using your new password. For security reasons, we recommend that you don't share your password with anyone.</p>
             <p>
   You can access your account by clicking the button below:
        </p>

        <a
          href=${link}
          style='display: inline-block; padding: 10px 20px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 20px;'
        >
          ${actionText}
        </a>
   
        <p>
     If you did not make this change or if you believe an unauthorized person has accessed your account, please contact our support team immediately.

        </p>
      <p>
  Thank you for using ExpenseTracker. We're committed to keeping your financial data secure.
        </p>
        <div style='margin-top: 30px; font-size: 12px; color: #666;'>
          <p>© 2024 ExpenseTracker. All rights reserved.</p>
          <p>123 Finance Street, Money City, MC 12345</p>
        </div>
      </body>
    `;
    await user.save();
    await sendEmails(subject, user.email, html);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const logout = (req, res) => {
  req.logOut((err) => {
    if (err) {
      return res.status(500).send('Could not log out.');
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send('Could not log out.');
      }

      res.status(200).send('Logged out successfully.');
    });
  });
};

export {
  register,
  verifyEmail,
  login,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  logout,
};
