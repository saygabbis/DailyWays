/** Shared presence field state + fan-out to active room senders (board + modal). */
const fieldsByRoom = new Map();
const sendersByRoom = new Set();

function roomFields(roomId) {
  if (!fieldsByRoom.has(roomId)) {
    fieldsByRoom.set(roomId, {
      cursor: null,
      selectedNodeIds: undefined,
      selectedCardId: null,
      draggingCardId: null,
      draggingListId: null,
      hoverCardId: null,
      hoverListId: null,
      cursorScreen: null,
    });
  }
  return fieldsByRoom.get(roomId);
}

export function getPresenceFields(roomId) {
  return roomFields(roomId);
}

export function registerPresenceSender(roomId, flushFn) {
  const key = `${roomId}:${flushFn}`;
  sendersByRoom.add({ roomId, flushFn, key });
  return () => {
    for (const entry of sendersByRoom) {
      if (entry.key === key) sendersByRoom.delete(entry);
    }
  };
}

export function pushPresenceFields(roomId, partial) {
  if (!roomId) return;
  Object.assign(roomFields(roomId), partial);
  for (const entry of sendersByRoom) {
    if (entry.roomId === roomId) entry.flushFn();
  }
}

/** Clear local presence fields when leaving a board room (avoid stale null cursor on rejoin). */
export function resetPresenceFields(roomId) {
  if (!roomId) return;
  const f = roomFields(roomId);
  f.cursor = null;
  f.cursorScreen = null;
  f.selectedCardId = null;
  f.draggingCardId = null;
  f.draggingListId = null;
  f.hoverCardId = null;
  f.hoverListId = null;
}

/** Fan-out presence emit to all hooks registered for this room (e.g. after join). */
export function announcePresence(roomId) {
  if (!roomId) return;
  let count = 0;
  for (const entry of sendersByRoom) {
    if (entry.roomId === roomId) {
      count += 1;
      entry.flushFn();
    }
  }
}
