import { Resend } from 'resend';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmails = async (subject, to, html) => {
  try {
    await resend.emails.send({
      from: process.env.RESEND_EMAIL,
      to,
      subject,
      html,
    });
  } catch (err) {
    logger.error(err);
  }
};

export { sendEmails };
