import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socketHandlers.js';

const PORT = Number(process.env.PORT || 3001);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5174';
const allowedOrigins = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/i.test(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) callback(null, true);
    else callback(new Error('CORS not allowed'));
  },
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'dailyways-collab' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error('CORS not allowed'));
    },
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
});

registerSocketHandlers(io);

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[collab-server] Port ${PORT} already in use. Stop the other process:\n` +
        `  netstat -ano | findstr :${PORT}\n` +
        `  Stop-Process -Id <PID> -Force`
    );
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[collab-server] listening on 0.0.0.0:${PORT} (cors: ${corsOrigin})`);
});
