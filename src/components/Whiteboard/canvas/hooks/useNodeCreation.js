/** Criação de nós no canvas: preview do gesto de criação (clique/arraste) e inserção com defaults, z-index e ações pós-criação. */
import { useEffect, useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { getDefaultNodePayload } from '../../../../stores/whiteboardStore';
import { applyToolVariantToPayload } from '../../core/creation/applyToolVariant.js';
import { insertNode } from '../../../../services/whiteboardService';
import { CREATE_DRAG_THRESHOLD_PX, CREATE_MIN_SIZE, creationToolToNodeType } from '../../interaction/hooks/useCreateTool';
import { screenToWorldWithContainer, findContainerAt } from '../../interaction/viewport/viewportUtils';
import {
    getZoomAwareCreateDims,
    getZoomAwareMinCreateSize,
} from '../../interaction/viewport/viewportCreation.js';
import { worldBoxFromAnchorWithModifiers } from '../../interaction/transform/createDragBounds';
import { cloneNode } from '../../core/history/whiteboardHistory';
import { filterNodesByPage } from '../../core/pages/whiteboardPages';
import { nodeToWorld, buildNodesById } from '../../core/ops/whiteboardNodeOps';
import { getCornerRadii } from '../../shared/appearanceStyle';
import { FRAME_CONSTRAINT_DEFAULT, normalizeFrameConstraints } from '../../core/frame/frameConstraints.js';
import { NODE_TYPES_ALLOWED } from '../../shared/constants';

const DEFAULT_NODE_RADIUS = {
    sticky_note: 8,
    comment: 8,
    todo_list: 8,
    link: 8,
    file_card: 8,
    frame: 8,
};

function getNextTopLevelZIndex(nodes) {
    const topLevel = (nodes || []).filter((n) => !n.parentId);
    if (!topLevel.length) return 0;
    return Math.max(...topLevel.map((n) => n.zIndex ?? 0)) + 1;
}

export function useNodeCreation(ctx) {
    const {
        spaceId,
        containerRef,
        createPreview,
        setCreatePreview,
        createDragRef,
        viewportRef,
        lastPointerClientRef,
        user,
        collabPatchNode,
        collabCreateNode,
        collabConnected,
    } = ctx;

    const dragPreviewBorderFromNode = useCallback((node) => {
        if (!node) return {};
        if (node.type === 'shape' && node.data?.shape === 'ellipse') {
            return { radiusShape: 'ellipse' };
        }
        const appearance = node.style?.appearance;
        if (appearance) {
            const corners = getCornerRadii(appearance);
            return { cornerRadii: corners };
        }
        if (typeof node.style?.borderRadius === 'number') {
            return { borderRadius: node.style.borderRadius };
        }
        const fallback = DEFAULT_NODE_RADIUS[node.type];
        if (typeof fallback === 'number') return { borderRadius: fallback };
        return {};
    }, []);

    const createNodeAt = useCallback(
        async (type, worldX, worldY, extraData = {}, dims) => {
            if (!spaceId || !NODE_TYPES_ALLOWED.includes(type)) return null;
            const defaultKey = type === 'drawing' ? 'draw' : type === 'file_card' ? 'file' : type;
            const payload = getDefaultNodePayload(defaultKey, worldX, worldY);
            payload.type = type;
            const pageId = useWhiteboardStore.getState().activePageId;
            Object.assign(payload.data, extraData.data || {}, { pageId });
            if (extraData.style) Object.assign(payload.style, extraData.style);
            if (dims?.width != null) payload.width = Math.max(CREATE_MIN_SIZE, dims.width);
            else {
                const z = viewportRef.current?.zoom ?? useWhiteboardSelectionStore.getState().viewport?.zoom ?? 1;
                payload.width = getZoomAwareCreateDims(defaultKey, z).width;
            }
            if (dims?.height != null) payload.height = Math.max(CREATE_MIN_SIZE, dims.height);
            else {
                const z = viewportRef.current?.zoom ?? useWhiteboardSelectionStore.getState().viewport?.zoom ?? 1;
                payload.height = getZoomAwareCreateDims(defaultKey, z).height;
            }
            const variantPayload = applyToolVariantToPayload(type, payload, extraData.variantId);
            Object.assign(payload, variantPayload);
            if (variantPayload.data) {
                payload.data = { ...payload.data, pageId };
            }
            const allNodes = useWhiteboardStore.getState().nodes;
            const pageNodes = filterNodesByPage(allNodes, pageId);
            const byId = buildNodesById(pageNodes);
            const centerX = worldX + (payload.width ?? 0) / 2;
            const centerY = worldY + (payload.height ?? 0) / 2;
            const container = findContainerAt(pageNodes, centerX, centerY);
            if (container) {
                const containerWorld = nodeToWorld(container, byId);
                payload.parentId = container.id;
                payload.x = worldX - containerWorld.x;
                payload.y = worldY - containerWorld.y;
                if (container.type === 'frame') {
                    payload.data = {
                        ...(payload.data || {}),
                        constraints: normalizeFrameConstraints(payload.data?.constraints || FRAME_CONSTRAINT_DEFAULT),
                    };
                }
            } else if (type === 'shape') {
                // New standalone shapes should appear above every top-level layer.
                payload.zIndex = getNextTopLevelZIndex(pageNodes);
            }
            if (collabConnected) {
                collabCreateNode({ ...payload, createdBy: user?.id ?? null });
            } else {
                const res = await insertNode(spaceId, payload, user?.id);
                if (res.success) {
                    useWhiteboardStore.getState().addNode(payload);
                } else {
                    return null;
                }
            }
            useWhiteboardStore.getState().pushHistory({
                type: 'node_add',
                payload: { node: cloneNode({ ...payload, createdBy: user?.id ?? null }) },
            });
            return payload.id;
        },
        [spaceId, user?.id, collabCreateNode, collabConnected]
    );

    const applyCreateDragBox = useCallback(
        async (drag, currentWorld, modifiers = {}) => {
            const zoom = viewportRef.current?.zoom ?? 1;
            const box = worldBoxFromAnchorWithModifiers(drag.anchorWorld, currentWorld, {
                minSize: getZoomAwareMinCreateSize(zoom),
                shiftKey: modifiers.shiftKey,
                altKey: modifiers.altKey,
                aspectRatio: drag.aspectRatio ?? 1,
            });
            const nodeType = creationToolToNodeType(drag.tool);
            if (!drag.nodeId) {
                if (!drag._initPromise) {
                    drag._initPromise = createNodeAt(nodeType, box.x, box.y, {}, {
                        width: box.width,
                        height: box.height,
                    }).then((id) => {
                        if (id) drag.nodeId = id;
                        return id;
                    });
                }
                await drag._initPromise;
            }
            if (drag.nodeId) {
                const state = useWhiteboardStore.getState();
                const node = state.nodes.find((n) => n.id === drag.nodeId);
                const patch = {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                };
                if (node?.parentId) {
                    const byId = buildNodesById(state.nodes);
                    const parent = byId.get(node.parentId);
                    if (parent) {
                        const parentWorld = nodeToWorld(parent, byId);
                        patch.x = box.x - parentWorld.x;
                        patch.y = box.y - parentWorld.y;
                    }
                }
                collabPatchNode(drag.nodeId, patch);
            }
        },
        [createNodeAt, collabPatchNode]
    );

    useEffect(() => {
        if (!createPreview) return undefined;
        const refreshFromModifiers = (e) => {
            if (e.key !== 'Shift' && e.key !== 'Alt') return;
            const drag = createDragRef.current;
            const p = lastPointerClientRef.current;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!drag?.anchorWorld || !p || !rect || !viewportRef.current) return;
            const currentWorld = screenToWorldWithContainer(p.x, p.y, rect, viewportRef.current);
            const modifiers = { shiftKey: e.shiftKey, altKey: e.altKey };
            const zoom = viewportRef.current?.zoom ?? 1;
            setCreatePreview((prev) =>
                prev
                    ? {
                          ...prev,
                          currentWorld,
                          shiftKey: modifiers.shiftKey,
                          altKey: modifiers.altKey,
                          minSize: getZoomAwareMinCreateSize(zoom),
                      }
                    : null
            );
            const dist = Math.hypot(p.x - drag.startScreen.x, p.y - drag.startScreen.y);
            if (dist >= CREATE_DRAG_THRESHOLD_PX) {
                void applyCreateDragBox(drag, currentWorld, modifiers);
            }
        };
        window.addEventListener('keydown', refreshFromModifiers);
        window.addEventListener('keyup', refreshFromModifiers);
        return () => {
            window.removeEventListener('keydown', refreshFromModifiers);
            window.removeEventListener('keyup', refreshFromModifiers);
        };
    }, [createPreview, applyCreateDragBox]);

    return {
        dragPreviewBorderFromNode,
        createNodeAt,
        applyCreateDragBox,
    };
}
