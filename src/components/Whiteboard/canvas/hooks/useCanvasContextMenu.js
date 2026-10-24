/** Menu de contexto do canvas (criar aqui, enviar imagem/arquivo) e soltar arquivos arrastados do sistema. */
import { useCallback } from 'react';
import { isImageFile } from '@dailyways/limits';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { getDefaultNodePayload } from '../../../../stores/whiteboardStore';
import { buildImageNodePayload } from '../../core/creation/imageNodePayload.js';
import { TOOL_VARIANT_MIME } from '../../panels/toolbar/toolMenuRegistry.js';
import { insertNode, uploadSpaceAsset } from '../../../../services/whiteboardService';
import { screenToWorldWithContainer, findContainerAt } from '../../interaction/viewport/viewportUtils';
import { pickGuideAt } from '../../interaction/guides/guideInteraction';
import { nodeToWorld, buildNodesById } from '../../core/ops/whiteboardNodeOps';
import { getNodeCreateOffset } from '../../core/whiteboardCreateOffsets';
import { applyPostCreateActions } from '../../core/creation/postCreateActions';
import { NODE_TYPES_ALLOWED } from '../../shared/constants';

export function useCanvasContextMenu(ctx) {
    const {
        spaceId,
        containerRef,
        contextMenuPosition,
        setContextMenuPosition,
        pendingUploadWorldPositionRef,
        openImagePickerRef,
        openFilePickerRef,
        rightMousePanRef,
        viewportRef,
        user,
        addToast,
        guardNodeLimit,
        collabCreateNode,
        collabConnected,
        activeTool,
        guidesVisible,
        createNodeAt,
        viewportForChildren,
        openSelectionContextMenu,
    } = ctx;

    const handleContextMenu = useCallback(
        (e) => {
            if (rightMousePanRef.current) {
                e.preventDefault();
                return;
            }
            const el = e.target;
            if (
                el?.closest?.('.whiteboard-node-wrapper') ||
                el?.closest?.('.whiteboard-viewport-controls') ||
                el?.closest?.('.whiteboard-bottom-dock') ||
                el?.closest?.('.whiteboard-bottom-chrome')
            ) {
                return;
            }
            e.preventDefault();
            const st = useWhiteboardStore.getState();
            const selStore = useWhiteboardSelectionStore.getState();
            if (selStore.selectedGuideIds.length > 0 && activeTool === 'select') {
                const locked = selStore.lockedGuideIds;
                const ids = selStore.selectedGuideIds;
                setContextMenuPosition({
                    left: e.clientX,
                    top: e.clientY,
                    mode: 'guide',
                    guideAllLocked: ids.every((id) => locked.includes(id)),
                });
                return;
            }
            const rectPick = containerRef.current?.getBoundingClientRect();
            const vpPick = viewportRef.current;
            if (rectPick && vpPick && activeTool === 'select' && guidesVisible) {
                const picked = pickGuideAt(
                    st.rulerGuides,
                    st.activePageId,
                    e.clientX,
                    e.clientY,
                    rectPick,
                    vpPick,
                    selStore.lockedGuideIds
                );
                if (picked) {
                    selStore.setSelectedGuideIds([picked]);
                    setContextMenuPosition({
                        left: e.clientX,
                        top: e.clientY,
                        mode: 'guide',
                        guideAllLocked: selStore.lockedGuideIds.includes(picked),
                    });
                    return;
                }
            }
            if (st.selectedNodeIds.length > 0 && activeTool === 'select') {
                openSelectionContextMenu(e.clientX, e.clientY);
                return;
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportForChildren) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            setContextMenuPosition({
                left: e.clientX,
                top: e.clientY,
                worldX: world.x,
                worldY: world.y,
                mode: 'create',
            });
        },
        [rightMousePanRef, activeTool, containerRef, viewportRef, guidesVisible, viewportForChildren, setContextMenuPosition, openSelectionContextMenu]
    );

    const handleContextMenuCreate = useCallback(
        async (type, worldX, worldY) => {
            const id = await createNodeAt(type, worldX, worldY);
            if (id) {
                applyPostCreateActions({
                    nodeId: id,
                    nodeType: type,
                    keepCreationTool: false,
                });
            }
            setContextMenuPosition(null);
        },
        [createNodeAt, setContextMenuPosition]
    );

    const handleContextMenuUploadImage = useCallback(() => {
        if (contextMenuPosition) {
            pendingUploadWorldPositionRef.current = {
                x: contextMenuPosition.worldX,
                y: contextMenuPosition.worldY,
                anchor: 'center',
            };
            setContextMenuPosition(null);
        }
        openImagePickerRef.current?.();
    }, [contextMenuPosition, openImagePickerRef, pendingUploadWorldPositionRef, setContextMenuPosition]);

    const handleContextMenuUploadFile = useCallback(() => {
        if (contextMenuPosition) {
            pendingUploadWorldPositionRef.current = {
                x: contextMenuPosition.worldX,
                y: contextMenuPosition.worldY,
                anchor: 'center',
            };
            setContextMenuPosition(null);
        }
        openFilePickerRef.current?.();
    }, [contextMenuPosition, openFilePickerRef, pendingUploadWorldPositionRef, setContextMenuPosition]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDrop = useCallback(
        async (e) => {
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportForChildren) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportForChildren);
            const toolType = e.dataTransfer.getData('application/x-whiteboard-tool');
            if (toolType && NODE_TYPES_ALLOWED.includes(toolType)) {
                const zoom = viewportForChildren.zoom ?? 1;
                const [ox, oy] = getNodeCreateOffset(toolType, zoom);
                let variantId = null;
                try {
                    const variantRaw = e.dataTransfer.getData(TOOL_VARIANT_MIME);
                    if (variantRaw) {
                        const parsed = JSON.parse(variantRaw);
                        if (parsed.toolId === toolType) variantId = parsed.variantId;
                    }
                } catch {
                    /* ignore malformed drag payload */
                }
                const id = await createNodeAt(toolType, world.x - ox, world.y - oy, { variantId });
                if (id) {
                    applyPostCreateActions({
                        nodeId: id,
                        nodeType: toolType,
                        keepCreationTool: e.ctrlKey || e.metaKey,
                    });
                }
                return;
            }
            const files = e.dataTransfer.files;
            if (!files?.length) return;
            const nodes = useWhiteboardStore.getState().nodes;
            const byId = buildNodesById(nodes);
            for (let i = 0; i < files.length; i++) {
                if (!guardNodeLimit(1)) break;
                const file = files[i];
                const asImage = isImageFile(file);
                let wx = world.x - 100 + i * 20;
                let wy = world.y - 75 + i * 20;
                if (!asImage) {
                    wx = world.x - 110 + i * 20;
                    wy = world.y - 40 + i * 20;
                }
                const centerX = wx + (asImage ? 100 : 110);
                const centerY = wy + (asImage ? 75 : 40);
                const container = findContainerAt(nodes, centerX, centerY);
                const result = await uploadSpaceAsset(spaceId, file, user?.id);
                if (!result?.url) {
                    addToast(result?.error || 'Falha ao enviar arquivo.', 'error');
                    continue;
                }
                if (asImage) {
                    const zoom = viewportForChildren.zoom ?? 1;
                    const payload = await buildImageNodePayload(
                        file,
                        result.storagePath,
                        {
                            x: world.x + i * 20,
                            y: world.y + i * 20,
                            anchor: 'center',
                        },
                        null,
                        zoom
                    );
                    const imgCenterX = payload.x + payload.width / 2;
                    const imgCenterY = payload.y + payload.height / 2;
                    const imgContainer = findContainerAt(nodes, imgCenterX, imgCenterY);
                    if (imgContainer) {
                        const containerWorld = nodeToWorld(imgContainer, byId);
                        payload.parentId = imgContainer.id;
                        payload.x = payload.x - containerWorld.x;
                        payload.y = payload.y - containerWorld.y;
                    }
                    if (collabConnected) {
                        collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                    } else {
                        const res = await insertNode(spaceId, payload, user?.id);
                        if (res.success) useWhiteboardStore.getState().addNode(payload);
                    }
                } else {
                    const sizeStr = file.size != null ? (file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '';
                    const payload = getDefaultNodePayload('file', wx, wy);
                    Object.assign(payload.data, { url: result.url, filename: file.name, size: sizeStr });
                    if (container) {
                        const containerWorld = nodeToWorld(container, byId);
                        payload.parentId = container.id;
                        payload.x = wx - containerWorld.x;
                        payload.y = wy - containerWorld.y;
                    }
                    if (collabConnected) {
                        collabCreateNode({ ...payload, createdBy: user?.id ?? null });
                    } else {
                        const res = await insertNode(spaceId, payload, user?.id);
                        if (res.success) useWhiteboardStore.getState().addNode(payload);
                    }
                }
            }
        },
        [containerRef, viewportForChildren, createNodeAt, guardNodeLimit, spaceId, user?.id, addToast, collabConnected, collabCreateNode]
    );

    return {
        handleContextMenu,
        handleContextMenuCreate,
        handleContextMenuUploadImage,
        handleContextMenuUploadFile,
        handleDragOver,
        handleDrop,
    };
}
