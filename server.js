import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
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

import { verifySocketToken } from './middleware/authMiddleware.js';

const app = express();
const server = http.createServer(app);

// ✅ Allowed frontend origins
const allowedOrigins = [
  'https://triptask-frontend.vercel.app',
  'https://triptask.vercel.app',
  'http://localhost:3000',
  'http://192.168.1.3:3000',
  'http://192.168.1.11:3000',
];

// ✅ Setup Socket.IO with CORS
const io = new SocketServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true, // ⚠️ Needed even if you're not using cookies
  },
});

// ✅ Socket.IO Bearer Token Auth
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.warn('❌ Socket.IO: Missing token');
    return next(new Error('Authentication error'));
  }

  const user = verifySocketToken(token);
  if (!user) {
    console.warn('❌ Socket.IO: Invalid token');
    return next(new Error('Authentication error'));
  }

  socket.user = user;
  next();
});

// ✅ Handle real-time socket events
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.user.email} (${socket.user.id})`);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`📥 ${socket.user.email} joined room: ${room}`);
  });

  socket.on('leave', (room) => {
    socket.leave(room);
    console.log(`📤 ${socket.user.email} left room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.user.email}`);
  });
});

// ✅ Make io available in routes
app.set('io', io);

// ✅ __dirname fix for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Ensure uploads dir exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Serve uploaded files
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadDir, req.path);
  const ext = path.extname(filePath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

  if (fs.existsSync(filePath)) {
    if (isImage) {
      return express.static(uploadDir)(req, res, next);
    } else {
      return res.download(filePath);
    }
  }

  res.status(404).send('File not found');
});

// ✅ Apply CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ Blocked CORS origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // ✅ Required for Safari & Authorization headers
  })
);

// ✅ Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: '⏱ Too many requests. Please try again later.',
});
app.use(globalLimiter);

// ✅ Middleware
app.use(express.json()); // ✅ parse JSON body
// ❌ cookieParser removed — all tokens are now in headers only

// ✅ API Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/chats', chatRoutes);
app.use('/users', userRoutes);
app.use('/service-status', serviceStatusRoutes);

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});
