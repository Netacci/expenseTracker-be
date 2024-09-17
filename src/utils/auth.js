import dotenv from 'dotenv';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import passport from 'passport';
import User from '../models/v1/users/auth.js';
import { sendEmails } from './resend.js';

dotenv.config();
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL}/api/v1/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });
        if (!user) {
          user = new User({
            email,
            googleId: profile.id,
            first_name: profile.name.givenName,
            is_email_verified: true,
          });
          await user.save();
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
        }
        if (!user.is_email_verified) {
          user.is_email_verified = true;
          await user.save();
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user._id);
});
// passport.deserializeUser((user, done) => {
//   done(null, user);
// });
passport.deserializeUser(async (email, done) => {
  try {
    const user = await User.findOne({ email });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
