// backend/routes/serviceStatus.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Middleware to parse JSON
router.use(express.json());

// ✅ GET /service-status — return current service status
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('service_status')
      .select('is_online')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.error('❌ Failed to fetch status:', error?.message);
      return res.status(500).json({ isOnline: true }); // assume online if error
    }

    return res.json({ isOnline: data.is_online });
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return res.status(500).json({ isOnline: true });
  }
});

// ✅ PUT /service-status — update status (admin or rider only)
router.put('/', requireAuth, async (req, res) => {
  const { isOnline } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'rider') {
    return res.status(403).json({ message: 'Forbidden: Only admin or rider can update status' });
  }

  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ message: 'Invalid "isOnline" value' });
  }

  try {
    const { error } = await supabase
      .from('service_status')
      .update({
        is_online: isOnline,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      console.error('❌ Failed to update status:', error.message);
      return res.status(500).json({ message: 'Error updating service status' });
    }

    // ✅ Emit real-time update using Socket.IO
    const io = req.app.get('io');
    io.emit('service-status', { isOnline });

    console.log(`🔧 Service status updated to: ${isOnline ? 'Online' : 'Offline'}`);
    return res.json({ message: 'Service status updated successfully' });
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
