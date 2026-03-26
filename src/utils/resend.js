import { Resend } from 'resend';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmails = async (subjectOrPayload, to, html) => {
  try {
    const payload =
      typeof subjectOrPayload === 'object'
        ? subjectOrPayload
        : { subject: subjectOrPayload, to, html };

    await resend.emails.send({
      from: process.env.RESEND_EMAIL,
      ...payload,
    });
  } catch (err) {
    logger.error(err);
  }
};

export { sendEmails };
