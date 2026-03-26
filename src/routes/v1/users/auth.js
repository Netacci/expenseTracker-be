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
const getClientBaseUrl = () =>
  (process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
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
  (req, res, next) => {
    passport.authenticate('google', (err, user) => {
      if (err) {
        logger.error(`Google auth callback error: ${err.stack || err.message}`);
        return res.redirect(
          `${getClientBaseUrl()}/error?reason=google_callback_error`
        );
      }
      if (!user) {
        logger.error('Google auth callback returned no user');
        return res.redirect(
          `${getClientBaseUrl()}/error?reason=google_no_user`
        );
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          logger.error(
            `Google auth session login error: ${loginErr.stack || loginErr.message}`
          );
          return res.redirect(
            `${getClientBaseUrl()}/error?reason=google_session_error`
          );
        }

        try {
          const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
          );
          return res.redirect(
            `${getClientBaseUrl()}/auth/google/callback?token=${token}`
          );
        } catch (tokenErr) {
          logger.error(
            `Google auth token sign error: ${tokenErr.stack || tokenErr.message}`
          );
          return res.redirect(
            `${getClientBaseUrl()}/error?reason=google_token_error`
          );
        }
      });
    })(req, res, next);
  }
);
router.post('/logout', logout);
export default router;
