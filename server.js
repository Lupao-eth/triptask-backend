import dotenv from 'dotenv';
dotenv.config();

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

import { verifySocketToken } from './middleware/authMiddleware.js';

const app = express();
const server = http.createServer(app);

// ✅ Allowed CORS origins (MUST be exact for Safari)
const allowedOrigins = [
  'https://triptask-frontend.vercel.app',
  'https://triptask.vercel.app',
  'http://localhost:3000',
  'http://192.168.1.3:3000',
  'http://192.168.1.11:3000',
];

// ✅ Setup Socket.IO with strict CORS
const io = new SocketServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ✅ Socket.IO token-based auth middleware (Option B)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log('❌ No token provided during Socket.IO handshake');
    return next(new Error('Authentication error'));
  }

  const user = verifySocketToken(token);
  if (!user) {
    console.log('❌ Invalid token');
    return next(new Error('Authentication error'));
  }

  socket.user = user;
  next();
});

// ✅ Handle Socket.IO events
io.on('connection', (socket) => {
  console.log(`📡 Connected: ${socket.user.email} (${socket.user.id})`);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`👥 ${socket.user.email} joined room: ${room}`);
  });

  socket.on('leave', (room) => {
    socket.leave(room);
    console.log(`🚪 ${socket.user.email} left room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.user.email}`);
  });
});

// ✅ Make io available to all routes
app.set('io', io);

// ✅ __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Ensure upload folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Serve static/downloadable files
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

// ✅ Setup CORS (same origin check as for Socket.IO)
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
    credentials: true,
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
app.use(express.json());
app.use(cookieParser());

// ✅ Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/chats', chatRoutes);
app.use('/users', userRoutes);
app.use('/service-status', serviceStatusRoutes);

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running with Socket.IO on http://0.0.0.0:${PORT}`);
});
