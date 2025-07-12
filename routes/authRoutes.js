import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
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

// ✅ Auth routes
router.post('/login', authLimiter, login);       // Login
router.post('/register', authLimiter, register); // Register
router.get('/me', requireAuth, getMe);           // Authenticated user info
router.post('/logout', logout);                  // Logout

// ✅ NEW: Issue JWT token for Socket.IO auth (Option B)
router.get('/token', requireAuth, (req, res) => {
  try {
    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // can adjust as needed
    );

    res.json({ token });
  } catch (err) {
    console.error('❌ Token generation error:', err.message);
    res.status(500).json({ message: 'Failed to issue token' });
  }
});

export default router;
