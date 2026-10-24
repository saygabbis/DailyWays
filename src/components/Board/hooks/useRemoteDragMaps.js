/** Mapas derivados dos drags remotos (colegas arrastando cards/listas), consumidos pelo render do board. */
import { useMemo } from 'react';

export function useRemoteDragMaps(ctx) {
    const {
        remoteDrags,
        remoteListDrags,
    } = ctx;

    const remoteDraggingCardIds = useMemo(
        () => new Set(remoteDrags.map((d) => d.cardId)),
        [remoteDrags],
    );
    const remoteDraggingListIds = useMemo(
        () => new Set(remoteListDrags.map((d) => d.listId)),
        [remoteListDrags],
    );
    const remoteDragByCardId = useMemo(() => {
        const map = {};
        for (const d of remoteDrags) map[d.cardId] = d;
        return map;
    }, [remoteDrags]);

    /** Peer de arrasto por card (inclui todos os slots da multiseleção remota). */
    const remoteDragPeerByCardId = useMemo(() => {
        const map = {};
        for (const d of remoteDrags) {
            if (d.multiDragCardIds?.length > 1) {
                for (const cardId of d.multiDragCardIds) {
                    map[cardId] = d;
                }
            } else if (d.cardId) {
                map[d.cardId] = d;
            }
        }
        return map;
    }, [remoteDrags]);

    const remoteMultiDragCompanionIds = useMemo(() => {
        const ids = new Set();
        for (const d of remoteDrags) {
            if (!d.multiDragCardIds || d.multiDragCardIds.length < 2) continue;
            for (const cardId of d.multiDragCardIds) {
                if (cardId !== d.cardId) ids.add(cardId);
            }
        }
        return ids;
    }, [remoteDrags]);
    const remoteDragByListId = useMemo(() => {
        const map = {};
        for (const d of remoteListDrags) map[d.listId] = d;
        return map;
    }, [remoteListDrags]);

    return {
        remoteDraggingCardIds,
        remoteDraggingListIds,
        remoteDragByCardId,
        remoteDragPeerByCardId,
        remoteMultiDragCompanionIds,
        remoteDragByListId,
    };
}
