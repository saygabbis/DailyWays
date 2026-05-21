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

      // #region agent log
      fetch('http://127.0.0.1:7493/ingest/0093f15a-2614-4c0e-9862-18929ca449cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed15fe'},body:JSON.stringify({sessionId:'ed15fe',runId:'cover-fix',hypothesisId:'H1-H4',location:'useCardCoverImage.js:loadCover',message:'cover load',data:{cardId:cardId?.slice(0,8),coverAttachmentId:coverAttachmentId?.slice(0,8),reason,hasUrl:!!result.url,error:result.error||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

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
