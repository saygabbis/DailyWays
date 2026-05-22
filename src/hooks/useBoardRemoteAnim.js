import { useSyncExternalStore } from 'react';
import {
  isRemoteCardAnimating,
  isRemoteListAnimating,
  subscribeRemoteCardAnim,
  subscribeRemoteListAnim,
} from '../collab/board/boardRemoteAnim';

export function useRemoteCardAnim(cardId) {
  return useSyncExternalStore(
    subscribeRemoteCardAnim,
    () => isRemoteCardAnimating(cardId),
    () => false,
  );
}

export function useRemoteListAnim(listId) {
  return useSyncExternalStore(
    subscribeRemoteListAnim,
    () => isRemoteListAnimating(listId),
    () => false,
  );
}
