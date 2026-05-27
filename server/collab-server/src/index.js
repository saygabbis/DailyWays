import './config/loadEnv.js';
import { validateCollabEnv } from './config/validateEnv.js';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket/socketHandlers.js';

const PORT = Number(process.env.PORT || 3001);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5174';
const allowedOrigins = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);

/** localhost + rede local (amigo no http://192.168.x.x:5174) — sempre permitido. */
function isPrivateLanOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(
    origin || '',
  );
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (isPrivateLanOrigin(origin)) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
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

validateCollabEnv();
registerSocketHandlers(io);

io.engine.on('connection_error', (err) => {
  // code 1 = "Session ID unknown" — aba/dispositivo com sid antigo após restart do collab (inofensivo).
  if (err.code === 1) return;
  const h = err.req?.headers || {};
  console.warn('[collab-server] connection_error', {
    code: err.code,
    message: err.message,
    origin: h.origin,
    connection: h.connection,
    upgrade: h.upgrade,
  });
});

io.on('connection', (socket) => {
  console.log('[collab-server] socket connected', socket.id);
});

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
