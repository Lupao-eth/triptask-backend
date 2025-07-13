import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireBearerAuth } from '../middleware/authMiddleware.js'; // ✅ token-based

const router = express.Router();

// ✅ Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Middleware to parse JSON
router.use(express.json());

// ✅ GET /service-status — public route
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('service_status')
      .select('is_online')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.error('❌ Failed to fetch status:', error?.message);
      return res.status(500).json({ isOnline: true }); // fallback to online
    }

    console.log('✅ GET /service-status →', data.is_online);
    return res.json({ isOnline: data.is_online });
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return res.status(500).json({ isOnline: true });
  }
});

// ✅ PUT /service-status — only admin or rider can update
router.put('/', requireBearerAuth, async (req, res) => {
  const { isOnline } = req.body;

  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ message: 'Invalid "isOnline" value' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'rider') {
    return res.status(403).json({ message: 'Forbidden: Only admin or rider can update status' });
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

    const io = req.app.get('io');
    if (io) {
      io.emit('service-status', { isOnline });
      console.log('📢 Emitted "service-status":', isOnline);
    }

    console.log(`🔧 Service status updated to: ${isOnline ? 'Online' : 'Offline'}`);
    return res.json({ message: 'Service status updated successfully' });
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
