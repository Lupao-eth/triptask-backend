// routes/upload.js
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const router = express.Router();

// 🧠 Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 📥 In-memory file storage (not saved to disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// 🚫 Rate limit: 5 uploads per minute
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: '⛔ Too many uploads. Try again later.' },
});

// ✅ Upload to Supabase (private bucket)
router.post('/', requireAuth, uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const file = req.file;
  const ext = file.originalname.split('.').pop();
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  const filePath = `${req.user.id}/${filename}`; // grouped per user

  try {
    const { error } = await supabase.storage
      .from('chat-uploads') // your private bucket
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase upload error:', error.message);
      return res.status(500).json({ message: 'Upload failed' });
    }

    // Only return storage path — use signed URL to access
    res.status(200).json({ url: filePath });
  } catch (err) {
    console.error('❌ Upload exception:', err.message);
    res.status(500).json({ message: 'Server error during upload' });
  }
});

export default router;
