import { useEffect, useState } from 'react';
import {
  fetchCoverAttachmentUrl,
  subscribeToAttachments,
} from '../services/attachmentService';

const coverUrlCache = new Map();

function cacheKey(cardId, attachmentId) {
  return `${cardId}:${attachmentId}`;
}

export function useCardCoverImage(cardId, coverAttachmentId) {
  const [coverUrl, setCoverUrl] = useState(() => {
    if (!cardId || !coverAttachmentId) return null;
    return coverUrlCache.get(cacheKey(cardId, coverAttachmentId)) || null;
  });

  useEffect(() => {
    let active = true;

    async function loadCover(reason) {
      if (!cardId || !coverAttachmentId) {
        if (active) setCoverUrl(null);
        return;
      }

      const key = cacheKey(cardId, coverAttachmentId);
      const cached = coverUrlCache.get(key);
      if (cached) {
        if (active) setCoverUrl(cached);
        return;
      }

      const result = await fetchCoverAttachmentUrl(cardId, coverAttachmentId);
      if (!active) return;

      if (result.url) {
        coverUrlCache.set(key, result.url);
        setCoverUrl(result.url);
      } else {
        setCoverUrl(null);
      }
    }

    loadCover('effect');
    const unsub = subscribeToAttachments(cardId, () => loadCover('realtime'));

    return () => {
      active = false;
      unsub();
    };
  }, [cardId, coverAttachmentId]);

  return coverUrl;
}
