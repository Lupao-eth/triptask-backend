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
router.post('/token', authLimiter, login);
router.post('/register', authLimiter, register);

// ✅ Refresh token route — used to get a new access token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Missing refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const newToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token: newToken });
  } catch (err) {
    console.error('❌ Refresh token error:', err.message);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// ✅ PROTECTED ROUTES
router.get('/me', requireBearerAuth, getMe);
router.post('/logout', logout);

// ✅ ISSUE NEW ACCESS TOKEN IF USER IS STILL LOGGED IN
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
