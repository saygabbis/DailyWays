import { useEffect, useState } from 'react';
import { fetchAttachments } from '../services/attachmentService';

export function useCardCoverImage(cardId, coverAttachmentId) {
  const [coverUrl, setCoverUrl] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadCover() {
      if (!cardId || !coverAttachmentId) {
        if (active) setCoverUrl(null);
        return;
      }

      const result = await fetchAttachments(cardId);
      if (!active) return;

      const cover = (result.data || []).find((attachment) => attachment.id === coverAttachmentId);
      setCoverUrl(cover?.publicUrl || null);
    }

    loadCover();
    return () => {
      active = false;
    };
  }, [cardId, coverAttachmentId]);

  return coverUrl;
}
