import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { checkServiceOnline } from '../middleware/checkServiceOnline.js';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import path from 'path';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔒 Memory storage, 5MB limit, filter
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// 🚫 Limit upload rate: 5/minute
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: 'Too many uploads. Try again later.' },
});

// ✅ GET /chats/:taskId
router.get('/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('task_id', taskId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const signedChats = await Promise.all(
      data.map(async (msg) => {
        if (Array.isArray(msg.file_urls) && msg.file_urls.length > 0) {
          const signedFiles = await Promise.all(
            msg.file_urls.map(async (fileObj) => {
              if (!fileObj?.url || !fileObj?.type) return null;

              const { data: signedData, error: signedErr } = await supabase
                .storage
                .from('chat-uploads')
                .createSignedUrl(fileObj.url, 60 * 60); // 1 hour

              if (signedErr) {
                console.error('⚠️ Signed URL error:', signedErr.message);
                return null;
              }

              return {
                url: signedData?.signedUrl || '',
                type: fileObj.type,
                name: fileObj.name || null,
              };
            })
          );

          msg.file_urls = signedFiles.filter(Boolean);
        }
        return msg;
      })
    );

    res.json(signedChats);
  } catch (err) {
    console.error('❌ GET /chats error:', err.message);
    res.status(500).json({ message: 'Error fetching chats' });
  }
});

// ✅ POST /chats — protected by auth + service check
router.post('/', requireAuth, checkServiceOnline, async (req, res) => {
  const { taskId, sender, text, fileUrls } = req.body;

  if (!taskId || !sender || (!text?.trim() && (!fileUrls || fileUrls.length === 0))) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const parsedFileUrls = Array.isArray(fileUrls) ? fileUrls : [];

    const { data, error } = await supabase
      .from('chats')
      .insert([{
        task_id: taskId,
        sender,
        text: text || '',
        file_urls: parsedFileUrls,
        timestamp: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ New chat saved for task-${taskId}`);
    res.status(201).json(data);
  } catch (err) {
    console.error('❌ POST /chats error:', err.message);
    res.status(500).json({ message: 'Error saving chat' });
  }
});

// ✅ POST /chats/upload — protected by auth + service check + limiter
router.post('/upload', requireAuth, checkServiceOnline, uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const ext = path.extname(req.file.originalname);
    const filename = `${Date.now()}-${uuidv4()}${ext}`;
    const filepath = `chat/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-uploads')
      .upload(filepath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    console.log('✅ Uploaded to Supabase:', filepath);

    res.status(200).json({
      url: filepath,
      type: req.file.mimetype,
      name: req.file.originalname,
    });
  } catch (err) {
    console.error('❌ Upload error:', err.message);
    res.status(500).json({ message: 'Upload failed' });
  }
});

export default router;
