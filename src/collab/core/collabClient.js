import { io } from 'socket.io-client';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@dailyways/collab-protocol';
import { getCollabServerUrl } from './collabConfig.js';
import { getBoardCollabMountGen, getGlobalJoinedBoardId } from '../board/sync/boardCollabSession.js';
import { isBoardPrankFrozen, isBoardPrankHeld } from '../board/dev/boardDevPrank.js';
let socketInstance = null;

export function getCollabSocket() {
  return socketInstance;
}

export function connectCollabSocket(token) {
  const url = getCollabServerUrl();
  if (!url || !token) return null;

  if (socketInstance?.connected) {
    socketInstance.auth = { token };
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  // Em produção (nginx/VPS) só polling — o upgrade WS falha e gera ruído/instabilidade.
  const pollingOnly =
    import.meta.env.PROD
    || (typeof window !== 'undefined'
      && !/localhost|127\.0\.0\.1/.test(window.location.hostname));
  socketInstance = io(url, {
    auth: { token },
    path: '/socket.io',
    forceNew: true,
    transports: pollingOnly ? ['polling'] : ['polling', 'websocket'],
    upgrade: !pollingOnly,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  return socketInstance;
}

export function disconnectCollabSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function waitForSocketConnected(socket, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Socket not connected'));
      return;
    }
    if (socket.connected) {
      resolve(socket);
      return;
    }
    const timer = setTimeout(() => {
      socket.off('connect', onConnect);
      reject(new Error('Socket not connected'));
    }, timeoutMs);
    const onConnect = () => {
      clearTimeout(timer);
      resolve(socket);
    };
    socket.once('connect', onConnect);
  });
}

export function joinRoom(socket, payload) {
  return new Promise((resolve, reject) => {
    if (isBoardPrankFrozen()) {
      reject(new Error('Board prank frozen'));
      return;
    }
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }
    socket.emit(CLIENT_EVENTS.JOIN, payload, (res) => {
      if (res?.ok) resolve(res);
      else reject(new Error(res?.error || 'Join failed'));
    });
  });
}

export function joinSpaceRoom(socket, spaceId) {
  return joinRoom(socket, { spaceId });
}

export async function joinBoardRoom(socket, boardId) {
  await waitForSocketConnected(socket);
  return joinRoom(socket, { boardId });
}

/**
 * @param {string} [boardId] — se informado, só sai se o socket ainda estiver nesta sala.
 * @param {{ mountGen?: number }} [opts] — cleanup com mountGen: não emite se um mount mais novo já existe.
 */
export function leaveRoom(socket, boardId = null, opts = {}) {
  const { mountGen } = opts;
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve();
      return;
    }
    if (mountGen != null && mountGen !== getBoardCollabMountGen()) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const payload = boardId ? { boardId } : {};
    socket.emit(CLIENT_EVENTS.LEAVE, payload, () => {
      if (mountGen != null && mountGen !== getBoardCollabMountGen()) return;
      done();
    });
    setTimeout(() => {
      if (mountGen != null && mountGen !== getBoardCollabMountGen()) return;
      done();
    }, 400);
  });
}

export const leaveSpaceRoom = leaveRoom;

export function submitOp(socket, op) {
  return new Promise((resolve, reject) => {
    if (isBoardPrankFrozen()) {
      reject(new Error('Board prank frozen'));
      return;
    }
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }
    socket.emit(CLIENT_EVENTS.OP, op, (res) => {
      if (res?.ok) resolve(res);
      else reject(new Error(res?.error || 'Op rejected'));
    });
  });
}

export function emitPresence(socket, payload) {
  if (!socket?.connected) return;
  if (isBoardPrankFrozen() || isBoardPrankHeld()) return;
  const boardId = payload?.roomId;
  const joined = getGlobalJoinedBoardId();
  // Só bloqueia se já estamos em outra sala; null !== boardId bloqueava todo envio (assimétrico).
  if (boardId && joined && joined !== boardId) return;
  socket.emit(CLIENT_EVENTS.PRESENCE, payload);
}

export { CLIENT_EVENTS, SERVER_EVENTS };
