// routes/authRoutes.js

import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, getMe, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Rate limiter for login and register routes
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // max 5 requests per IP per minute
  message: {
    message: '⛔ Too many attempts. Please try again later.',
  },
});

// ✅ Apply limiter
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);
router.get('/me', requireAuth, getMe);

// ✅ Logout route
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'Lax', // adjust depending on frontend/backend domains
    secure: false,   // set to true if using HTTPS
  });
  res.json({ message: 'Logged out successfully' });
});

export default router;
