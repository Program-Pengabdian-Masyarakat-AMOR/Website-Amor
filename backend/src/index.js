import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initBridge } from './services/firebaseBridge.js';
import { warmupAiEngine } from './services/aiEngine.js';

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: env.corsOrigin, credentials: true },
});

// Wajibkan JWT valid di handshake socket (token dikirim FE via auth.token).
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('unauthorized'));
  try {
    socket.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log('[socket] klien terhubung:', socket.id, `(${socket.user?.username})`);
  socket.on('disconnect', () => console.log('[socket] klien putus:', socket.id));
});

// Jembatan Firebase → emit 'sensor-update' & 'health-update' ke semua klien.
initBridge(io);
warmupAiEngine().catch((e) => console.error('[ai] warmup gagal:', e.message));

httpServer.listen(env.port, () => {
  console.log(`[server] AMOR backend jalan di http://localhost:${env.port}`);
  console.log(`[server] API base: http://localhost:${env.port}/api`);
});
