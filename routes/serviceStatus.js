// backend/routes/serviceStatus.js
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ✅ Middleware to parse JSON
router.use(express.json())

// ✅ GET current service status
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('service_status')
    .select('is_online')
    .eq('id', 1)
    .single()

  if (error || !data) {
    return res.status(500).json({ message: 'Error fetching service status' })
  }

  return res.json({ isOnline: data.is_online })
})

// ✅ PUT to update service status (admin-only)
router.put('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'rider') {
  return res.status(403).json({ message: 'Forbidden: Only admin or rider can update status' })
}


  const { isOnline } = req.body
  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ message: 'Missing or invalid isOnline value' })
  }

  const { error } = await supabase
    .from('service_status')
    .update({
      is_online: isOnline,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) {
    return res.status(500).json({ message: 'Error updating status' })
  }

  return res.json({ message: 'Service status updated successfully' })
})

export default router
