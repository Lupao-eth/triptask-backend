import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { requireBearerAuth } from '../middleware/authMiddleware.js'; // ✅ Updated for token-based auth

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ GET /users - Only accessible by token-authenticated users
router.get('/', requireBearerAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role'); // Modify fields if needed

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('❌ Failed to load users from Supabase', err.message);
    res.status(500).json({ message: 'Failed to load users' });
  }
});

export default router;
