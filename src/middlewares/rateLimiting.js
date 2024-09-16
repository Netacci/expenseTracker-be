import rateLimit from 'express-rate-limit';

// Create a rate limiter with a maximum of 5 requests per 15 minutes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes)
  message: 'Too many login attempts from this IP, please try again later.',
});
