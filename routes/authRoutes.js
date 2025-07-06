// routes/authRoutes.js

import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, getMe, register, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Apply rate limit to prevent brute-force login/register attempts
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute
  message: {
    message: '⛔ Too many attempts. Please try again later.',
  },
});

// ✅ Routes
router.post('/login', authLimiter, login);       // Login
router.post('/register', authLimiter, register); // Register
router.get('/me', requireAuth, getMe);           // Authenticated user info
router.post('/logout', logout);                  // Logout

export default router;
