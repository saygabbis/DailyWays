import { io } from 'socket.io-client';
import { CLIENT_EVENTS } from '@dailyways/collab-protocol';
import { getCollabServerUrl } from './collabConfig.js';
import { getBoardCollabMountGen } from '../board/sync/boardCollabSession.js';
import { isBoardPrankFrozen, isBoardPrankHeld } from '../board/dev/boardDevPrank.js';
import { shouldEmitPresenceForRoom } from '../shared/session/presenceGuards.js';
import { getJoinedRoomId } from '../shared/session/scopeSessionState.js';
let socketInstance = null;

/**
 * Ops enviadas POR ESTA ABA (o servidor devolve o op:applied também para quem enviou).
 * Antes o filtro era por usuário, então a 2ª aba do mesmo usuário ignorava tudo da 1ª.
 */
const OWN_OP_LIMIT = 2000;
const ownOpIds = new Set();

function rememberOwnOp(opId) {
  if (!opId) return;
  ownOpIds.add(opId);
  if (ownOpIds.size > OWN_OP_LIMIT) {
    ownOpIds.delete(ownOpIds.values().next().value);
  }
}

export function isOwnOp(opId) {
  return Boolean(opId) && ownOpIds.has(opId);
}

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

  // Começa em polling e sobe para WebSocket quando o proxy deixa (o nginx de deploy/ faz o upgrade).
  // Se o upgrade falhar, o socket.io segue em polling sozinho. Só polling: VITE_COLLAB_POLLING_ONLY=1.
  // Antes produção ficava SEMPRE em polling: cada alteração virava uma requisição HTTP (lento).
  const pollingOnly = import.meta.env.VITE_COLLAB_POLLING_ONLY === '1';
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

function waitForSocketConnected(socket, timeoutMs = 10000) {
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

function joinRoom(socket, payload) {
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
    rememberOwnOp(op?.opId);
    // Sem resposta (socket caiu, servidor travou) a promessa não pode ficar pendurada para sempre:
    // quem chamou devolve a op para a fila e reenvia ao reconectar.
    const timer = setTimeout(() => reject(new Error('Op timeout')), OP_TIMEOUT_MS);
    socket.emit(CLIENT_EVENTS.OP, op, (res) => {
      clearTimeout(timer);
      if (res?.ok) resolve(res);
      else reject(new Error(res?.error || 'Op rejected'));
    });
  });
}

const OP_TIMEOUT_MS = 10000;
const BOARD_OP_TIMEOUT_MS = 8000;

/** Op de board sem estar na sala dele: o servidor collab aplica, avisa a sala e persiste. */
export function submitBoardOp(socket, boardId, op) {
  return new Promise((resolve, reject) => {
    if (isBoardPrankFrozen()) {
      reject(new Error('Board prank frozen'));
      return;
    }
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }
    rememberOwnOp(op?.opId);
    const timer = setTimeout(() => reject(new Error('Board op timeout')), BOARD_OP_TIMEOUT_MS);
    socket.emit(CLIENT_EVENTS.BOARD_OP, { boardId, op }, (res) => {
      clearTimeout(timer);
      if (res?.ok) resolve(res);
      else reject(new Error(res?.error || 'Op rejected'));
    });
  });
}

export function emitPresence(socket, payload) {
  if (!socket?.connected) return;
  if (isBoardPrankFrozen() || isBoardPrankHeld()) return;
  const requestedRoomId = payload?.roomId;
  const joinedBoardRoomId = getJoinedRoomId('board');
  const joinedSpaceRoomId = getJoinedRoomId('space');
  const boardMatches = shouldEmitPresenceForRoom({
    requestedRoomId,
    joinedRoomId: joinedBoardRoomId,
  });
  const spaceMatches = shouldEmitPresenceForRoom({
    requestedRoomId,
    joinedRoomId: joinedSpaceRoomId,
  });
  if (!boardMatches && !spaceMatches) return;
  socket.emit(CLIENT_EVENTS.PRESENCE, payload);
}

;
