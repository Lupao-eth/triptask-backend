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
import http from 'http';
import { Server as SocketServer } from 'socket.io';

import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import chatRoutes from './routes/chats.js';
import userRoutes from './routes/users.js';
import serviceStatusRoutes from './routes/serviceStatus.js';

const app = express();
const server = http.createServer(app);

// ✅ Setup Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: [
      'https://triptask-frontend.vercel.app',
      'https://triptask.vercel.app',
      'http://localhost:3000',
      'http://192.168.1.3:3000',
      'http://192.168.1.11:3000',
    ],
    credentials: true,
  },
});

// ✅ Make io available to all routes
app.set('io', io);

// ✅ Handle Socket.IO client connections
io.on('connection', (socket) => {
  console.log('📡 Client connected to Socket.IO');

  socket.on('join', (room) => {
  socket.join(room);
  console.log(`👥 Joined room: ${room}`);
});


  socket.on('leave', (room) => {
  socket.leave(room);
  console.log(`🚪 Left room: ${room}`);
});


  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
  });
});

// ✅ __dirname support for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Ensure /uploads folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Serve static files or download
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

// ✅ CORS settings
const allowedOrigins = [
  'https://triptask-frontend.vercel.app',
  'https://triptask.vercel.app',
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
    credentials: true,
  })
);

// ✅ Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: '⏱ Too many requests. Please try again later.',
});
app.use(globalLimiter);

// ✅ Global middlewares
app.use(express.json());
app.use(cookieParser());

// ✅ Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/chats', chatRoutes);
app.use('/users', userRoutes);
app.use('/service-status', serviceStatusRoutes); // will emit Socket.IO update

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () =>
  console.log(`✅ Server with Socket.IO running on http://0.0.0.0:${PORT}`)
);
