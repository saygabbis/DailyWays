/** Upload de imagens e arquivos para o space (picker, colar ou soltar), criando o nó correspondente. */
import { useCallback } from 'react';
import { isImageFile } from '@dailyways/limits';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { getDefaultNodePayload } from '../../../../stores/whiteboardStore';
import { buildImageNodePayload } from '../../core/creation/imageNodePayload.js';
import { insertNode, uploadSpaceAsset } from '../../../../services/whiteboardService';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';

export function useCanvasUploads(ctx) {
    const {
        spaceId,
        containerRef,
        pendingUploadWorldPositionRef,
        viewportRef,
        user,
        addToast,
        guardNodeLimit,
        collabCreateNode,
        collabConnected,
    } = ctx;

    const getViewportCenterWorld = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !viewportRef.current) return { x: 0, y: 0 };
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return screenToWorldWithContainer(cx, cy, rect, viewportRef.current);
    }, [containerRef, viewportRef]);

    const handleUploadImage = useCallback(
        async (file) => {
            if (!spaceId || !file) return;
            if (!guardNodeLimit(1)) return;
            if (!guardNodeLimit(1)) return;
            if (!isImageFile(file)) {
                console.warn('[CanvasEngine] handleUploadImage: not an image file', file.name);
                return;
            }
            try {
                const result = await uploadSpaceAsset(spaceId, file, user?.id);
                if (!result.url) {
                    addToast(result.error || 'Falha ao enviar imagem.', 'error');
                    return;
                }
                let placement;
                const pending = pendingUploadWorldPositionRef.current;
                if (pending) {
                    pendingUploadWorldPositionRef.current = null;
                    placement = { x: pending.x, y: pending.y, anchor: pending.anchor ?? 'center' };
                } else {
                    const center = getViewportCenterWorld();
                    placement = { x: center.x, y: center.y, anchor: 'center' };
                }
                const zoom = viewportRef.current?.zoom ?? 1;
                const payload = await buildImageNodePayload(
                    file,
                    result.storagePath,
                    placement,
                    null,
                    zoom
                );
                if (collabConnected) {
                    collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                } else {
                    const res = await insertNode(spaceId, payload, user?.id);
                    if (res.success) useWhiteboardStore.getState().addNode(payload);
                }
            } catch (err) {
                console.error('[CanvasEngine] handleUploadImage error', err);
            }
        },
        [spaceId, guardNodeLimit, user?.id, pendingUploadWorldPositionRef, viewportRef, collabConnected, addToast, getViewportCenterWorld, collabCreateNode]
    );

    const handleUploadFile = useCallback(
        async (file) => {
            if (!spaceId || !file) return;
            if (!guardNodeLimit(1)) return;
            try {
                const result = await uploadSpaceAsset(spaceId, file, user?.id);
                if (!result.url) {
                    addToast(result.error || 'Falha ao enviar arquivo.', 'error');
                    return;
                }
                let placement;
                const pending = pendingUploadWorldPositionRef.current;
                if (pending) {
                    pendingUploadWorldPositionRef.current = null;
                    placement = { x: pending.x, y: pending.y, anchor: pending.anchor ?? 'center' };
                } else {
                    const center = getViewportCenterWorld();
                    placement = { x: center.x, y: center.y, anchor: 'center' };
                }
                const isImage = file.type?.startsWith('image/');
                if (isImage) {
                    const zoom = viewportRef.current?.zoom ?? 1;
                    const payload = await buildImageNodePayload(
                        file,
                        result.storagePath,
                        placement,
                        null,
                        zoom
                    );
                    if (collabConnected) {
                        collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                    } else {
                        const res = await insertNode(spaceId, payload, user?.id);
                        if (res.success) useWhiteboardStore.getState().addNode(payload);
                    }
                    return;
                }
                const sizeStr = file.size != null ? (file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '';
                const defaultKey = 'file';
                const offsetX = 110;
                const offsetY = 40;
                const place = placement.anchor === 'topleft'
                    ? placement
                    : { x: placement.x - offsetX, y: placement.y - offsetY, anchor: 'topleft' };
                const payload = getDefaultNodePayload(defaultKey, place.x, place.y);
                Object.assign(payload.data, { url: result.url, filename: file.name, size: sizeStr });
                if (collabConnected) {
                    collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                } else {
                    const res = await insertNode(spaceId, payload, user?.id);
                    if (res.success) useWhiteboardStore.getState().addNode(payload);
                }
            } catch (err) {
                console.error('[CanvasEngine] handleUploadFile error', err);
            }
        },
        [spaceId, guardNodeLimit, user?.id, pendingUploadWorldPositionRef, collabConnected, addToast, getViewportCenterWorld, viewportRef, collabCreateNode]
    );

    return {
        getViewportCenterWorld,
        handleUploadImage,
        handleUploadFile,
    };
}
