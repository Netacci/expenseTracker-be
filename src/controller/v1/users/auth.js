import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../../models/v1/users/auth.js';
import { sendEmail } from '../../../utils/emails.js';
import validator from 'validator';
import { body } from 'express-validator';
import logger from '../../../utils/logger.js';

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

    const subject = 'Verify your email to complete registration';
    const dynamicData = {
      first_name: user.first_name,
      verification_link: link,
      subject: subject,
    };
    const templateId = process.env.SENDGRID_TEMPLATE_ID;
    await sendEmail(user.email, templateId, subject, dynamicData);
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
  await sendEmail(
    user.email,
    process.env.SENDGRID_TEMPLATE_ID,
    'Verify your email',
    {
      verification_link: link,
      subject: 'Resend Verification',
    }
  );

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
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    await user.save();
    res.status(200).json({
      status: 200,
    });
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
    await user.save();
    const subject = 'Password reset request';
    const templateId = process.env.SENDGRID_TEMPLATE_ID_RESET;
    const link = `${hostlink}/reset-password/${token}`;
    const dynamicData = {
      verification_link: link,
      subject: subject,
    };

    await sendEmail(user.email, templateId, subject, dynamicData);
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
    await user.save();
    // TODO Send out email to notifiy user that passssword has been reset
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const authCheck = async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if the user still exists in the database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // If everything is fine, return success
    return res.status(200).json({ message: 'Authenticated' });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
const logout = (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // only use secure in production
      sameSite: 'strict',
    });
    return res.status(200).json({ message: 'Logout successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export {
  register,
  verifyEmail,
  login,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  authCheck,
  logout,
};
