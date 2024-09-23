import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  resendVerificationEmail,
  resetPassword,
  forgotPassword,
  logout,
} from '../../../controller/v1/users/auth.js';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { loginLimiter } from '../../../middlewares/rateLimiting.js';
import logger from '../../../utils/logger.js';

const router = Router();
router.post('/register', register);
router.put('/verify-email', verifyEmail);
router.post('/login', loginLimiter, login);
router.put('/resend-verification-email', resendVerificationEmail);
router.put('/reset-password', resetPassword);

router.put('/forgot-password', forgotPassword);
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
      res.redirect(
        `${process.env.BASE_URL}/auth/google/callback?token=${token}`
      );
    } catch (error) {
      logger.error('Error in Google callback:', error);
      res.redirect(`${process.env.BASE_URL}/error`);
    }
  }
);
router.post('/logout', logout);
export default router;
