import sendGrid from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

sendGrid.setApiKey(process.env.SENDGRID_API_KEY);
const sendEmail = async (to, templateId, subject, dynamicData) => {
  try {
    await sendGrid.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      template_id: templateId,
      subject,
      dynamic_template_data: dynamicData,
    });
  } catch (e) {
    console.error(e);

    return e.message;
  }
};

export { sendEmail };
