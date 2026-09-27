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
  const role = socket.user?.role;
  if (role) socket.join(`role:${role}`);

  // Telemetri mesin hanya untuk admin/operator. Management tetap login, tetapi tidak
  // otomatis menerima event sensor/health/control yang sensitif.
  if (role === 'admin' || role === 'operator') socket.join('telemetry');

  console.log('[socket] klien terhubung:', socket.id, `(${socket.user?.username}/${role || 'unknown'})`);
  socket.on('disconnect', () => console.log('[socket] klien putus:', socket.id));
});

// Jembatan Firebase → emit realtime ke room sesuai role.
initBridge(io);
warmupAiEngine().catch((e) => console.error('[ai] warmup gagal:', e.message));

httpServer.listen(env.port, () => {
  console.log(`[server] AMOR backend jalan di http://localhost:${env.port}`);
  console.log(`[server] API base: http://localhost:${env.port}/api`);
});
