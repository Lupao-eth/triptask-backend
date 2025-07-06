// routes/authRoutes.js

import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, getMe, register, logout } from '../controllers/authController.js'; // ✅ include logout
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

// ✅ Apply limiter to auth routes
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);
router.get('/me', requireAuth, getMe);

// ✅ Logout route (now using controller)
router.post('/logout', logout);

export default router;
