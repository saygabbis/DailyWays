import { useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  resolvePresenceColor,
  extractDominantColorFromImage,
  setCachedPhotoPresenceColor,
} from '../utils/presenceColor';
import { emitPresence } from './collabClient.js';
import { buildBoardPresencePayload, buildCursorPresencePayload } from './presencePayload.js';
import { useCollab } from './CollabContext.jsx';
import {
  getPresenceFields,
  registerPresenceSender,
  pushPresenceFields as pushFields,
} from './presenceBridge.js';
import { getGlobalJoinedBoardId } from './boardCollabSession.js';

const CURSOR_EMIT_MS = 16;
const META_EMIT_MS = 80;

export function useCollabPresence(roomId, { mode = 'world' } = {}) {
  const collab = useCollab();
  const { user, profile } = useAuth();
  const metaTimerRef = useRef(null);
  const cursorTimerRef = useRef(null);
  const lastCursorEmitAtRef = useRef(0);
  const cursorTrailingPendingRef = useRef(false);

  const presenceColor = resolvePresenceColor({
    userId: user?.id,
    presenceColor: profile?.presence_color,
    presenceColorAuto: profile?.presence_color_auto !== false,
    photoUrl: profile?.photo_url,
  });

  useEffect(() => {
    if (!user?.id || profile?.presence_color_auto === false || !profile?.photo_url) return;
    let cancelled = false;
    extractDominantColorFromImage(profile.photo_url).then((color) => {
      if (cancelled || !color) return;
      setCachedPhotoPresenceColor(user.id, color);
    });
    return () => { cancelled = true; };
  }, [user?.id, profile?.photo_url, profile?.presence_color_auto]);

  const authRef = useRef({ user, profile });
  authRef.current = { user, profile };

  const buildPayload = useCallback(() => {
    if (!roomId) return {};
    return buildBoardPresencePayload(roomId, authRef.current);
  }, [roomId, user?.id, profile?.name, profile?.photo_url, profile?.presence_color]);

  const canEmitPresence = useCallback(() => {
    if (!roomId || !collab?.socket?.connected) return false;
    return getGlobalJoinedBoardId() === roomId;
  }, [roomId, collab?.socket, collab?.connected]);

  const flushPresence = useCallback(() => {
    const socket = collab?.socket;
    if (!canEmitPresence()) return;
    emitPresence(socket, buildPayload());
  }, [collab?.socket, canEmitPresence, buildPayload]);

  const flushCursor = useCallback(() => {
    const socket = collab?.socket;
    if (!canEmitPresence()) return;
    const payload = buildCursorPresencePayload(roomId, authRef.current);
    if (payload.cursor) emitPresence(socket, payload);
  }, [collab?.socket, roomId, canEmitPresence]);

  const scheduleMetaSend = useCallback(() => {
    if (metaTimerRef.current) clearTimeout(metaTimerRef.current);
    metaTimerRef.current = setTimeout(() => {
      metaTimerRef.current = null;
      flushPresence();
    }, META_EMIT_MS);
  }, [flushPresence]);

  const emitCursorNow = useCallback(() => {
    lastCursorEmitAtRef.current = Date.now();
    flushCursor();
  }, [flushCursor]);

  const scheduleCursorSend = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastCursorEmitAtRef.current;

    if (elapsed >= CURSOR_EMIT_MS) {
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
        cursorTrailingPendingRef.current = false;
      }
      emitCursorNow();
      return;
    }

    if (cursorTrailingPendingRef.current) return;
    cursorTrailingPendingRef.current = true;
    const wait = CURSOR_EMIT_MS - elapsed;
    cursorTimerRef.current = setTimeout(() => {
      cursorTimerRef.current = null;
      cursorTrailingPendingRef.current = false;
      emitCursorNow();
    }, wait);
  }, [emitCursorNow]);

  useEffect(() => {
    if (!roomId) return undefined;
    return registerPresenceSender(roomId, scheduleMetaSend);
  }, [roomId, scheduleMetaSend]);

  useEffect(() => () => {
    if (metaTimerRef.current) clearTimeout(metaTimerRef.current);
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
  }, []);

  useEffect(() => {
    if (presenceColor) scheduleMetaSend();
  }, [presenceColor, scheduleMetaSend]);

  useEffect(() => {
    if (!roomId || !collab?.connected) return undefined;
    flushPresence();
    const intervalId = setInterval(flushPresence, 2500);
    return () => clearInterval(intervalId);
  }, [roomId, collab?.connected, flushPresence]);

  const mergeFields = useCallback((partial) => {
    if (!roomId) return;
    pushFields(roomId, partial);
  }, [roomId]);

  const updateCursor = useCallback((coords) => {
    if (!roomId) return;
    const fields = getPresenceFields(roomId);
    if (!coords) {
      // Não emitir cursor:null — apagava o cursor no servidor para os outros.
      return;
    }
    if (mode === 'screen') {
      fields.cursor = { x: coords.x, y: coords.y, mode: 'screen' };
      fields.cursorScreen = coords.cursorScreen ?? { x: coords.x, y: coords.y };
      if ('selectedCardId' in coords) {
        fields.selectedCardId = coords.selectedCardId;
      }
    } else {
      fields.cursor = { x: coords.x, y: coords.y };
      fields.selectedNodeIds = coords.selectedNodeIds;
    }
    scheduleCursorSend();
  }, [roomId, mode, flushPresence, scheduleCursorSend]);

  const updateSelection = useCallback((selectedNodeIds) => {
    mergeFields({ selectedNodeIds: selectedNodeIds || [] });
  }, [mergeFields]);

  const setHoverTarget = useCallback(({ cardId = null, listId = null } = {}) => {
    mergeFields({
      hoverCardId: cardId,
      hoverListId: listId,
    });
  }, [mergeFields]);

  const clearHoverTarget = useCallback(() => {
    mergeFields({ hoverCardId: null, hoverListId: null });
  }, [mergeFields]);

  const setDragTarget = useCallback(({ cardId = null, listId = null } = {}) => {
    mergeFields({
      draggingCardId: cardId,
      draggingListId: listId,
    });
  }, [mergeFields]);

  const clearDragTarget = useCallback(() => {
    mergeFields({ draggingCardId: null, draggingListId: null });
  }, [mergeFields]);

  const setSelectedCardId = useCallback((cardId) => {
    mergeFields({ selectedCardId: cardId ?? null });
  }, [mergeFields]);

  return {
    updateCursor,
    updateSelection,
    setHoverTarget,
    clearHoverTarget,
    setDragTarget,
    clearDragTarget,
    setSelectedCardId,
    connected: collab?.connected ?? false,
    presenceColor,
  };
}
