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
import http from 'http';
import logger from './src/utils/logger.js';

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
      secure: process.env.NODE_ENV === 'production',
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('Connected to mongoDB');
  })
  .catch((err) => {
    logger.error(`Error connecting to mongoDB ${err}`);
  });

app.use(bodyParser.json());
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

const corsOptions = {
  origin: process.env.CORS_ORIGINS.split(','),
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
const server = http.createServer(app);

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

app.listen(process.env.PORT || 5001, () => {
  logger.info(`Server running on port ${process.env.PORT}`);
});
