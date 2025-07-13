import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

import { login, getMe, register, logout } from '../controllers/authController.js';
import { requireBearerAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Supabase client (using service role key for secure server-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Rate limiter to prevent abuse
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: '⛔ Too many attempts. Please try again later.' },
});

// ✅ Public routes
router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);

// ✅ Protected routes (Bearer token only)
router.get('/me', requireBearerAuth, getMe);
router.post('/logout', logout);

// ✅ GET /auth/token – issue new token from logged-in user
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

// ✅ POST /auth/token – login via email/password → return token
router.post('/token', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = data.session.access_token;
    const refreshToken = data.session.refresh_token;
    const user = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role || 'customer',
    };

    res.json({ token, refreshToken, user });
  } catch (err) {
    console.error('❌ /auth/token error:', err.message);
    res.status(500).json({ message: 'Login failed' });
  }
});

export default router;
