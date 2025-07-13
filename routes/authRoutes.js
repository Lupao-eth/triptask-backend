import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { login, getMe, register, logout } from '../controllers/authController.js';
import { requireBearerAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Rate limiter to prevent abuse
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: '⛔ Too many attempts. Please try again later.' },
});

// ✅ PUBLIC ROUTES
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);

// ✅ PROTECTED ROUTES
router.get('/me', requireBearerAuth, getMe);
router.post('/logout', logout);

// ✅ ISSUE NEW ACCESS TOKEN IF USER IS AUTHENTICATED
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
