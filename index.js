import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import mongoose from 'mongoose';
import session from 'express-session';
import bodyParser from 'body-parser';
import passport from './src/utils/auth.js';
import userAuthRoutes from './src/routes/v1/users/auth.js';
import userRoutes from './src/routes/v1/users/user.js';
import budgetRoutes from './src/routes/v1/users/budget.js';

dotenv.config();
const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      secure: false,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to mongoDB');
  })
  .catch((err) => {
    console.log(`Error connecting to mongoDB ${err}`);
  });

app.use(bodyParser.json());
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
const corsOptions = {
  origin: [
    'http://localhost:5000',
    'http://localhost:5173',
    'https://expense-tracker-netaccis-projects.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Access-Control-Allow-Credentials',
  ],
};
app.use(cors(corsOptions));
app.use('/api/v1/auth', userAuthRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/budgets', budgetRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
