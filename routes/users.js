// routes/users.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { requireAuth } from '../middleware/authMiddleware.js'; // ✅ Add this

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ GET /users - Only accessible by authenticated users
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role'); // You can remove email if unnecessary

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('❌ Failed to load users from Supabase', err);
    res.status(500).json({ message: 'Failed to load users' });
  }
});

export default router;
