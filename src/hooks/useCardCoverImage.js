import { useEffect, useState } from 'react';
import { fetchCoverUrls } from '../services/attachmentService';

/**
 * URL da capa de um card. Antes cada card com capa fazia 2 requisições e abria um canal Realtime
 * próprio (um board com 40 capas = 40 canais). Agora os pedidos do mesmo instante viram UMA
 * consulta + UMA geração de URLs assinadas, e a URL fica em cache até perto de expirar.
 */

const CACHE_MARGIN_MS = 5 * 60 * 1000;
/** attachmentId → { url, expiresAt } (url null = sem imagem: anexo apagado, não é imagem…) */
const cache = new Map();
const waiting = new Map();
let batchTimer = null;

function readCache(attachmentId) {
  const hit = cache.get(attachmentId);
  if (!hit) return undefined;
  if (hit.expiresAt - CACHE_MARGIN_MS < Date.now()) {
    cache.delete(attachmentId);
    return undefined;
  }
  return hit.url;
}

function flushBatch() {
  batchTimer = null;
  const batch = new Map(waiting);
  waiting.clear();
  const ids = [...batch.keys()];
  fetchCoverUrls(ids).then((byId) => {
    for (const id of ids) {
      const entry = byId[id] ?? { url: null, expiresAt: Date.now() + 60_000 };
      cache.set(id, entry);
      for (const resolve of batch.get(id)) resolve(entry.url);
    }
  });
}

function loadCover(attachmentId) {
  return new Promise((resolve) => {
    if (!waiting.has(attachmentId)) waiting.set(attachmentId, []);
    waiting.get(attachmentId).push(resolve);
    if (!batchTimer) batchTimer = setTimeout(flushBatch, 16);
  });
}

/** Depois de definir uma capa nova (upload), já guarda a URL conhecida. */
export function primeCardCover(attachmentId, url, ttlSeconds = 3600) {
  if (attachmentId && url) cache.set(attachmentId, { url, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function useCardCoverImage(_cardId, coverAttachmentId) {
  const [state, setState] = useState(() => ({ id: coverAttachmentId, url: readCache(coverAttachmentId) ?? null }));
  // Mudou a capa: começa do cache (ou vazio) no próprio render, sem piscar a capa anterior.
  if (state.id !== coverAttachmentId) {
    setState({ id: coverAttachmentId, url: readCache(coverAttachmentId) ?? null });
  }

  useEffect(() => {
    if (!coverAttachmentId || readCache(coverAttachmentId) !== undefined) return undefined;
    let active = true;
    loadCover(coverAttachmentId).then((url) => {
      if (active) setState({ id: coverAttachmentId, url });
    });
    return () => {
      active = false;
    };
  }, [coverAttachmentId]);

  return coverAttachmentId ? state.url : null;
}
