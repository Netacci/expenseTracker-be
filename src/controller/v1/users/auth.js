import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../../models/v1/users/auth.js';
import { sendEmail } from '../../../utils/emails.js';
import passport from 'passport';
const register = async (req, res) => {
  const { email, password, first_name } = req.body;
  try {
    if (!email || !password || !first_name) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
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
    const isPasswordCorrect = bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d',
      }
    );

    await user.save();
    res.status(200).json({ token, status: 200, data: user });
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

export {
  register,
  verifyEmail,
  login,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
};
