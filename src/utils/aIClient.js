// import OpenAI from 'openai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

// export const client = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });
export const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
