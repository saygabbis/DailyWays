const WINDOW_MS = 1000;
const GC_INTERVAL_MS = 60_000;

export const MAX_OPS_PER_SEC = Number(process.env.COLLAB_MAX_OPS_PER_SEC || 120);
export const MAX_POSITION_OPS_PER_SEC = Number(process.env.COLLAB_MAX_POSITION_OPS_PER_SEC || 300);
export const MAX_OPS_PER_IP_PER_SEC = Number(process.env.COLLAB_MAX_OPS_PER_IP_PER_SEC || 240);
export const MAX_CONNECTIONS_PER_USER = Number(process.env.COLLAB_MAX_CONNECTIONS_PER_USER || 10);
export const MAX_AUTH_FAILS_PER_IP_PER_MIN = Number(process.env.COLLAB_MAX_AUTH_FAILS_PER_IP || 60);

const userOpWindows = new Map();
const ipOpWindows = new Map();
const userConnections = new Map();
const ipAuthFails = new Map();

function gcStale() {
  const now = Date.now();
  for (const [key, entry] of userOpWindows) {
    if (now - entry.windowStart > WINDOW_MS * 2) userOpWindows.delete(key);
  }
  for (const [key, entry] of ipOpWindows) {
    if (now - entry.windowStart > WINDOW_MS * 2) ipOpWindows.delete(key);
  }
  for (const [ip, entry] of ipAuthFails) {
    if (now - entry.windowStart > 60_000) ipAuthFails.delete(ip);
  }
}

const gcTimer = setInterval(gcStale, GC_INTERVAL_MS);
if (gcTimer.unref) gcTimer.unref();

export function getClientIp(handshake) {
  const forwarded = handshake?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return handshake?.address || 'unknown';
}

export function checkAuthFailRateLimit(handshake) {
  const ip = getClientIp(handshake);
  const now = Date.now();
  let entry = ipAuthFails.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    entry = { windowStart: now, count: 0 };
    ipAuthFails.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= MAX_AUTH_FAILS_PER_IP_PER_MIN;
}

export function registerUserConnection(userId) {
  if (!userId) return { ok: false, reason: 'No user' };
  const count = (userConnections.get(userId) || 0) + 1;
  if (count > MAX_CONNECTIONS_PER_USER) {
    return { ok: false, reason: 'Too many connections' };
  }
  userConnections.set(userId, count);
  return { ok: true };
}

export function releaseUserConnection(userId) {
  if (!userId) return;
  const count = userConnections.get(userId) || 0;
  if (count <= 1) userConnections.delete(userId);
  else userConnections.set(userId, count - 1);
}

function bumpWindow(map, key, isPositionOp) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, opCount: 0, positionOpCount: 0 };
    map.set(key, entry);
  }
  if (isPositionOp) {
    entry.positionOpCount += 1;
    return entry.positionOpCount <= MAX_POSITION_OPS_PER_SEC;
  }
  entry.opCount += 1;
  return entry.opCount <= MAX_OPS_PER_SEC;
}

export function checkOpRateLimit(userId, isPositionOp, clientIp) {
  if (!userId) return { ok: false, reason: 'Rate limit' };
  if (!bumpWindow(userOpWindows, userId, isPositionOp)) {
    return { ok: false, reason: 'Rate limit' };
  }
  if (clientIp && !bumpWindow(ipOpWindows, clientIp, isPositionOp)) {
    return { ok: false, reason: 'Rate limit' };
  }
  return { ok: true };
}
