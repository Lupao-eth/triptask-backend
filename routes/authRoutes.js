import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { login, getMe, register, logout } from '../controllers/authController.js';
import { requireBearerAuth } from '../middleware/authMiddleware.js'; // 🔄 changed from requireAuth

const router = express.Router();

// ✅ Rate limiter to prevent abuse
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    message: '⛔ Too many attempts. Please try again later.',
  },
});

// ✅ Public routes
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);

// ✅ Protected routes (now using token in header, not cookie)
router.get('/me', requireBearerAuth, getMe);
router.post('/logout', logout);

// ✅ Token endpoint (for Socket.IO or client use)
router.get('/token', requireBearerAuth, (req, res) => {
  try {
    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (err) {
    console.error('❌ Token generation error:', err.message);
    res.status(500).json({ message: 'Failed to issue token' });
  }
});

export default router;
