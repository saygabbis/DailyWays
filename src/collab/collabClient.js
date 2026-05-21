import { io } from 'socket.io-client';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@dailyways/collab-protocol';
import { getCollabServerUrl } from './collabConfig.js';

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

export function joinRoom(socket, payload) {
  return new Promise((resolve, reject) => {
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

export function joinBoardRoom(socket, boardId) {
  return joinRoom(socket, { boardId });
}

/** @param {string} [boardId] — se informado, só sai se o socket ainda estiver nesta sala (evita cleanup atrasado apagar sala nova). */
export function leaveRoom(socket, boardId = null) {
  return new Promise((resolve) => {
    if (!socket?.connected) {
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
    socket.emit(CLIENT_EVENTS.LEAVE, payload, () => done());
    setTimeout(done, 400);
  });
}

export const leaveSpaceRoom = leaveRoom;

export function submitOp(socket, op) {
  return new Promise((resolve, reject) => {
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
  if (socket?.connected) {
    socket.emit(CLIENT_EVENTS.PRESENCE, payload);
  }
}

export { CLIENT_EVENTS, SERVER_EVENTS };
