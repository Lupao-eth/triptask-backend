import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { checkServiceOnline } from '../middleware/checkServiceOnline.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Rate limiters
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: '⛔ Too many task submissions. Please try again later.' },
});

const updateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: '⛔ Too many update attempts. Slow down.' },
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: '⛔ Too many delete requests. Wait a moment.' },
});

// 👤 Get all tasks for a customer
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(tasks);
  } catch (err) {
    console.error('❌ Failed to fetch tasks:', err.message);
    res.status(500).json({ message: 'Failed to load tasks' });
  }
});

// 📦 Available bookings for riders
router.get('/available', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'rider') return res.status(403).json({ message: 'Access denied' });

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ tasks });
  } catch (err) {
    console.error('❌ Failed to fetch available tasks:', err.message);
    res.status(500).json({ message: 'Failed to load available tasks' });
  }
});

// 🚚 Active bookings for riders
router.get('/active', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'rider') return res.status(403).json({ message: 'Access denied' });

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .in('status', ['accepted', 'on_the_way'])
      .eq('assigned_rider_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ tasks });
  } catch (err) {
    console.error('❌ Failed to fetch active tasks:', err.message);
    res.status(500).json({ message: 'Failed to load active tasks' });
  }
});

// ✅ Task history for riders
router.get('/history', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'rider') return res.status(403).json({ message: 'Access denied' });

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .in('status', ['completed', 'cancelled'])
      .eq('assigned_rider_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(tasks);
  } catch (err) {
    console.error('❌ Failed to fetch task history:', err.message);
    res.status(500).json({ message: 'Failed to fetch task history' });
  }
});

// 📝 Create a new task (customer)
router.post('/', requireAuth, checkServiceOnline, createLimiter, async (req, res) => {
  const { name, task, pickup, dropoff, datetime, notes } = req.body;
  if (!name || !task || !pickup || !dropoff || !datetime) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert([{
        user_id: req.user.id,
        name,
        task,
        pickup,
        dropoff,
        datetime,
        notes,
        status: 'pending',
        assigned_rider_id: null,
      }])
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Task saved successfully', task: newTask });
  } catch (err) {
    console.error('❌ Failed to create task:', err.message);
    res.status(500).json({ message: 'Failed to save task' });
  }
});

// 🔄 Update task (status, details)
router.put('/:id', requireAuth, checkServiceOnline, updateLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid task ID' });

  const { name, pickup, dropoff, datetime, notes, status } = req.body;

  try {
    const { data: task, error: getError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !task) return res.status(404).json({ message: 'Task not found' });

    let updated = null;

    if (req.user.role === 'customer') {
      if (task.user_id !== req.user.id || task.status !== 'pending') {
        return res.status(403).json({ message: 'Only your pending tasks can be updated' });
      }

      const result = await supabase
        .from('tasks')
        .update({ name, pickup, dropoff, datetime, notes })
        .eq('id', id)
        .select()
        .single();

      if (result.error) throw result.error;
      updated = result.data;
    }

    if (req.user.role === 'rider') {
      const updateFields = {};
      if (task.status === 'pending') {
        updateFields.status = 'accepted';
        updateFields.assigned_rider_id = req.user.id;
      } else if (['accepted', 'on_the_way'].includes(task.status) && status) {
        updateFields.status = status;
      }

      const result = await supabase
        .from('tasks')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (result.error) throw result.error;
      updated = result.data;
    }

    if (!updated) return res.status(403).json({ message: 'Unauthorized update' });

    // Emit Socket.IO task update
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${id}`).emit('status-update', { status: updated.status });
      console.log(`📢 Emitted status-update → chat-${id}`);
    }

    return res.json({ message: 'Task updated', task: updated });
  } catch (err) {
    console.error('❌ Failed to update task:', err.message);
    res.status(500).json({ message: 'Failed to update task' });
  }
});

// ❌ Cancel task (customer)
router.delete('/:id', requireAuth, checkServiceOnline, deleteLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid task ID' });

  try {
    const { data: task, error: getError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (getError || !task) return res.status(404).json({ message: 'Task not found' });
    if (task.status !== 'pending') {
      return res.status(403).json({ message: 'Only pending tasks can be cancelled' });
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Emit cancel update
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${id}`).emit('status-update', { status: updatedTask.status });
      console.log(`📢 Emitted taskUpdated (cancelled) → task-${id}`);
    }

    res.json({ message: 'Task cancelled successfully', task: updatedTask });
  } catch (err) {
    console.error('❌ Failed to cancel task:', err.message);
    res.status(500).json({ message: 'Failed to cancel task' });
  }
});

// 🔍 Get a single task by ID
router.get('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid task ID' });

  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !task) throw error;
    res.json(task);
  } catch (err) {
    console.error('❌ Failed to fetch task:', err.message);
    res.status(500).json({ message: 'Failed to fetch task' });
  }
});

export default router;
