// server.js
import dotenv from 'dotenv';
dotenv.config();
console.log('🌍 SUPABASE_URL:', process.env.SUPABASE_URL);

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import chatRoutes from './routes/chats.js';
import userRoutes from './routes/users.js';

const app = express();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Serve /uploads: auto-download non-images
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadDir, req.path);
  const ext = path.extname(filePath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

  if (fs.existsSync(filePath)) {
    if (!isImage) {
      return res.download(filePath);
    } else {
      return express.static(uploadDir)(req, res, next);
    }
  } else {
    res.status(404).send('File not found');
  }
});

// ✅ CORS config
const allowedOrigins = [
  'https://triptask-frontend.vercel.app',
  'http://localhost:3000',
  'http://192.168.1.3:3000',
  'http://192.168.1.11:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ CORS blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // 👈 important for sending cookies
  })
);

// ✅ Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP
  message: '⏱ Too many requests. Please try again later.',
});
app.use(globalLimiter);

// ✅ Middleware
app.use(express.json());
app.use(cookieParser());

// ✅ Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/chats', chatRoutes);
app.use('/users', userRoutes);

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`)
);
