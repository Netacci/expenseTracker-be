import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  resendVerificationEmail,
  resetPassword,
  forgotPassword,
  authCheck,
  logout,
} from '../../../controller/v1/users/auth.js';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { loginLimiter } from '../../../middlewares/rateLimiting.js';
import logger from '../../../utils/logger.js';
import authenticate from '../../../middlewares/authenticate.js';

const router = Router();
router.post('/register', register);
router.put('/verify-email', verifyEmail);
router.post('/login', loginLimiter, login);
router.put('/resend-verification-email', resendVerificationEmail);
router.put('/reset-password', resetPassword);

router.put('/forgot-password', forgotPassword);
router.get('/check', authenticate('user'), authCheck);
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    try {
      const token = jwt.sign(
        { id: req.user._id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      res.cookie('token', token, {
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Ensures cookie is sent over HTTPS in production
        sameSite: 'strict', // Prevents CSRF attacks by ensuring the cookie is sent only to the same site
        maxAge: 24 * 60 * 60 * 1000, // 1 day expiration
      });
      res.redirect(`${process.env.BASE_URL}/auth/google/callback`);
    } catch (error) {
      logger.error('Error in Google callback:', error);
      res.redirect(`${process.env.BASE_URL}/login`);
    }
  }
);
router.post('/logout', authenticate('user'), logout);

export default router;
