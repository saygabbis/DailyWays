/** Redimensionar e rotacionar nós (inclui snap, proporção com Shift e restrições de filhos de frame). */
import { useEffect, useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { screenToWorldWithContainer } from '../../interaction/viewport/viewportUtils';
import { IMAGE_RESIZE_MIN_WORLD } from '../../interaction/viewport/viewportLimits.js';
import { computeResizeBounds } from '../../interaction/transform/resizeBounds';
import { computeSkewResizeBounds } from '../../interaction/transform/resizeSkew';
import {
    buildImageResizeModifiers,
    getImageResizeStartMode,
    mergeImageObjectFitPatch,
    shouldUseSkewResize,
} from '../../interaction/transform/imageResize';
import { captureNodesSnapshot, cloneNode } from '../../core/history/whiteboardHistory';
import { getNodeCenterWorld, pointerWorldAngleDeg, computeRotationFromPointer } from '../../interaction/transform/rotatePointer';
import { computeSnapForResize, buildSnapExcludeIds } from '../../interaction/snap/whiteboardSnap';
import { nodeToWorld, worldTopLeftToNodePatch, buildNodesById } from '../../core/ops/whiteboardNodeOps';
import {
    SELECTION_TRANSFORM_ID,
    getTransformTargetIds,
    getUnifiedSelectionBox,
    computeMultiResizePatches,
    computeMultiRotatePatches,
    getSelectionTransformCenter,
} from '../../interaction/transform/selectionTransform';
import { applyFrameResizeToChildren } from '../../core/frame/frameConstraints.js';

export function useResizeRotate(ctx) {
    const {
        containerRef,
        resizeActiveRef,
        resizeState,
        setResizeState,
        rotateState,
        setRotateState,
        nodeDragRef,
        viewportRef,
        collabPatchNodeRef,
        collabPatchNodesRef,
        setSnapGuidesIfChangedRef,
    } = ctx;

    const handleResizeStart = useCallback((nodeId, corner, e) => {
        e.stopPropagation();
        e.preventDefault();
        nodeDragRef.current = null;
        resizeActiveRef.current = true;
        if (e.currentTarget?.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        const state = useWhiteboardStore.getState();
        setRotateState(null);

        if (nodeId === SELECTION_TRANSFORM_ID) {
            const transformIds = getTransformTargetIds(state.selectedNodeIds, state.nodes, {
                groupDrill: state.groupDrill,
                isolateSelection: state.isolateSelection,
            });
            if (transformIds.length < 2) {
                resizeActiveRef.current = false;
                return;
            }
            const beforeSnapshots = captureNodesSnapshot(useWhiteboardStore, transformIds);
            if (!beforeSnapshots.length) {
                resizeActiveRef.current = false;
                return;
            }
            const box = getUnifiedSelectionBox(state.nodes, transformIds);
            if (!box) return;
            setResizeState({
                mode: 'selection',
                nodeIds: transformIds,
                corner,
                beforeSnapshots,
                snapExcludeIds: buildSnapExcludeIds(transformIds, state.nodes),
                origin: {
                    x: box.minX,
                    y: box.minY,
                    width: box.width,
                    height: box.height,
                },
            });
            return;
        }

        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const childIds = node.type === 'frame'
            ? state.nodes.filter((n) => n.parentId === nodeId).map((n) => n.id)
            : [];
        const trackedIds = [nodeId, ...childIds];
        setResizeState({
            nodeId,
            corner,
            mode: getImageResizeStartMode(node.type, e.ctrlKey || e.metaKey),
            beforeNode: cloneNode(node),
            beforeSnapshots: captureNodesSnapshot(useWhiteboardStore, trackedIds),
            snapExcludeIds: buildSnapExcludeIds([nodeId], state.nodes),
            origin: {
                x: node.x,
                y: node.y,
                width: node.width ?? 0,
                height: node.height ?? 0,
                skewX: node.skewX ?? 0,
                skewY: node.skewY ?? 0,
            },
        });
    }, [nodeDragRef, resizeActiveRef, setResizeState, setRotateState]);

    useEffect(() => {
        if (!resizeState) return;

        if (resizeState.mode === 'selection') {
            const { corner: handle, origin, beforeSnapshots, nodeIds, snapExcludeIds } = resizeState;
            let rafId = 0;
            let pendingEvent = null;
            const flushMove = () => {
                rafId = 0;
                const e = pendingEvent;
                if (!e) return;
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect || !viewportRef.current) return;
                const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
                const state = useWhiteboardStore.getState();
                const selectedNodes = state.nodes.filter((n) => nodeIds.includes(n.id));
                const resizeMin =
                    selectedNodes.length > 0 && selectedNodes.every((n) => n.type === 'image')
                        ? IMAGE_RESIZE_MIN_WORLD
                        : 0;
                const modifiers = { shiftKey: e.shiftKey, altKey: e.altKey, min: resizeMin };
                const newBox = computeResizeBounds(origin, handle, world, modifiers);
                const { box: snappedBox, guides } = computeSnapForResize({
                    box: newBox,
                    handle,
                    nodes: state.nodes,
                    movingIds: nodeIds,
                    zoom: viewportRef.current?.zoom ?? 1,
                    pageId: state.activePageId,
                    fromCenter: modifiers.altKey,
                    originForAspect: modifiers.shiftKey ? origin : null,
                    enabled: state.snapEnabled,
                    guidesVisible: state.guidesVisible,
                    rulerGuides: state.rulerGuides,
                    excludeIds: snapExcludeIds,
                });
                setSnapGuidesIfChangedRef.current(guides);
                const patches = computeMultiResizePatches(
                    beforeSnapshots,
                    state.nodes,
                    origin,
                    snappedBox
                );
                if (patches.length) collabPatchNodesRef.current(patches);
            };
            const onMove = (e) => {
                pendingEvent = e;
                if (rafId) return;
                rafId = requestAnimationFrame(flushMove);
            };
            const finishResize = () => {
                if (rafId) cancelAnimationFrame(rafId);
                setSnapGuidesIfChangedRef.current([]);
                const before = resizeState.beforeSnapshots ?? [];
                const after = captureNodesSnapshot(useWhiteboardStore, nodeIds);
                const changed =
                    before.length > 0 &&
                    before.some((b, i) => {
                        const a = after[i];
                        if (!a) return true;
                        return JSON.stringify(b.node) !== JSON.stringify(a.node);
                    });
                if (changed) {
                    useWhiteboardStore.getState().pushHistory({
                        type: 'nodes_replace',
                        payload: { before, after },
                    });
                }
                resizeActiveRef.current = false;
                setResizeState(null);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', finishResize);
            window.addEventListener('pointercancel', finishResize);
            return () => {
                if (rafId) cancelAnimationFrame(rafId);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', finishResize);
                window.removeEventListener('pointercancel', finishResize);
                resizeActiveRef.current = false;
            };
        }

        const { nodeId, corner: handle, origin, mode, snapExcludeIds } = resizeState;
        let rafId = 0;
        let pendingEvent = null;
        const flushMove = () => {
            rafId = 0;
            const e = pendingEvent;
            if (!e) return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportRef.current) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
            const state = useWhiteboardStore.getState();
            const node = state.nodes.find((n) => n.id === nodeId);
            if (!node) return;
            const modifiers = buildImageResizeModifiers(node, origin, e);
            const byId = buildNodesById(state.nodes);
            const worldTop = nodeToWorld({ ...node, x: origin.x, y: origin.y }, byId);
            const worldOrigin = {
                x: worldTop.x,
                y: worldTop.y,
                width: origin.width ?? 0,
                height: origin.height ?? 0,
                skewX: origin.skewX ?? 0,
                skewY: origin.skewY ?? 0,
            };
            if (shouldUseSkewResize(node, e.ctrlKey || e.metaKey, mode)) {
                setSnapGuidesIfChangedRef.current([]);
                const skewPatch = computeSkewResizeBounds(worldOrigin, handle, world, modifiers);
                collabPatchNodeRef.current(
                    nodeId,
                    worldTopLeftToNodePatch(node, skewPatch.x, skewPatch.y, state.nodes, {
                        width: skewPatch.width,
                        height: skewPatch.height,
                        skewX: skewPatch.skewX,
                        skewY: skewPatch.skewY,
                    })
                );
                return;
            }
            const patch = computeResizeBounds(worldOrigin, handle, world, modifiers);
            const worldBox = {
                x: patch.x,
                y: patch.y,
                width: patch.width ?? 0,
                height: patch.height ?? 0,
            };
            const { box: snappedBox, guides } = computeSnapForResize({
                box: worldBox,
                handle,
                nodes: state.nodes,
                movingIds: [nodeId],
                zoom: viewportRef.current?.zoom ?? 1,
                pageId: state.activePageId,
                fromCenter: modifiers.altKey,
                originForAspect: modifiers.shiftKey ? worldOrigin : null,
                enabled: state.snapEnabled,
                guidesVisible: state.guidesVisible,
                rulerGuides: state.rulerGuides,
                excludeIds: snapExcludeIds,
            });
            setSnapGuidesIfChangedRef.current(guides);
            let finalPatch = worldTopLeftToNodePatch(node, snappedBox.x, snappedBox.y, state.nodes, {
                width: snappedBox.width,
                height: snappedBox.height,
            });
            finalPatch = mergeImageObjectFitPatch(node, finalPatch, e);
            if (node.type === 'frame') {
                const nextFrame = {
                    x: finalPatch.x ?? node.x ?? 0,
                    y: finalPatch.y ?? node.y ?? 0,
                    width: finalPatch.width ?? node.width ?? 0,
                    height: finalPatch.height ?? node.height ?? 0,
                };
                const children = state.nodes.filter((n) => n.parentId === nodeId);
                const childPatches = applyFrameResizeToChildren(children, origin, nextFrame);
                if (childPatches.length > 0) {
                    collabPatchNodesRef.current([{ id: nodeId, patch: finalPatch }, ...childPatches]);
                    return;
                }
            }
            collabPatchNodeRef.current(nodeId, finalPatch);
        };
        const onMove = (e) => {
            pendingEvent = e;
            if (rafId) return;
            rafId = requestAnimationFrame(flushMove);
        };
        const finishResize = () => {
            if (rafId) cancelAnimationFrame(rafId);
            setSnapGuidesIfChangedRef.current([]);
            const before = resizeState.beforeSnapshots?.length
                ? resizeState.beforeSnapshots
                : (resizeState.beforeNode ? [{ id: nodeId, node: resizeState.beforeNode }] : []);
            const trackedIds = before.map((b) => b.id);
            const after = captureNodesSnapshot(useWhiteboardStore, trackedIds);
            const changed =
                before.length > 0 &&
                before.some((b, i) => {
                    const a = after[i];
                    if (!a) return true;
                    return JSON.stringify(b.node) !== JSON.stringify(a.node);
                });
            if (changed) {
                useWhiteboardStore.getState().pushHistory({
                    type: 'nodes_replace',
                    payload: {
                        before,
                        after,
                    },
                });
            }
            resizeActiveRef.current = false;
            setResizeState(null);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', finishResize);
        window.addEventListener('pointercancel', finishResize);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finishResize);
            window.removeEventListener('pointercancel', finishResize);
            resizeActiveRef.current = false;
        };
    }, [collabPatchNodeRef, collabPatchNodesRef, containerRef, resizeActiveRef, resizeState, setResizeState, setSnapGuidesIfChangedRef, viewportRef]);

    const handleRotateStart = useCallback((nodeId, e) => {
        e.stopPropagation();
        e.preventDefault();
        nodeDragRef.current = null;
        resizeActiveRef.current = true;
        if (e.currentTarget?.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        const state = useWhiteboardStore.getState();
        const rect = containerRef.current?.getBoundingClientRect();
        const vp = viewportRef.current;
        if (!rect || !vp) {
            resizeActiveRef.current = false;
            return;
        }
        const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, vp);
        setResizeState(null);

        if (nodeId === SELECTION_TRANSFORM_ID) {
            const transformIds = getTransformTargetIds(state.selectedNodeIds, state.nodes, {
                groupDrill: state.groupDrill,
                isolateSelection: state.isolateSelection,
            });
            if (transformIds.length < 2) {
                resizeActiveRef.current = false;
                return;
            }
            const beforeSnapshots = captureNodesSnapshot(useWhiteboardStore, transformIds);
            const center = getSelectionTransformCenter(state.nodes, transformIds);
            setRotateState({
                mode: 'selection',
                nodeIds: transformIds,
                beforeSnapshots,
                center,
                startAngle: pointerWorldAngleDeg(center.x, center.y, world.x, world.y),
            });
            return;
        }

        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const center = getNodeCenterWorld(node, state.nodes);
        setRotateState({
            nodeId,
            beforeNode: cloneNode(node),
            center,
            originRotation: node.rotation ?? 0,
            startAngle: pointerWorldAngleDeg(center.x, center.y, world.x, world.y),
        });
    }, [containerRef, nodeDragRef, resizeActiveRef, setResizeState, setRotateState, viewportRef]);

    useEffect(() => {
        if (!rotateState) return;

        if (rotateState.mode === 'selection') {
            const { center, startAngle, beforeSnapshots, nodeIds } = rotateState;
            const onMove = (e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect || !viewportRef.current) return;
                const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
                const currentAngle = pointerWorldAngleDeg(center.x, center.y, world.x, world.y);
                let delta = currentAngle - startAngle;
                if (e.shiftKey) {
                    delta = Math.round(delta / 15) * 15;
                }
                const state = useWhiteboardStore.getState();
                const patches = computeMultiRotatePatches(
                    beforeSnapshots,
                    state.nodes,
                    center,
                    delta
                );
                if (patches.length) collabPatchNodesRef.current(patches);
            };
            const finishRotate = () => {
                const before = rotateState.beforeSnapshots ?? [];
                const after = captureNodesSnapshot(useWhiteboardStore, nodeIds);
                const changed =
                    before.length > 0 &&
                    before.some((b, i) => {
                        const a = after[i];
                        if (!a) return true;
                        return JSON.stringify(b.node) !== JSON.stringify(a.node);
                    });
                if (changed) {
                    useWhiteboardStore.getState().pushHistory({
                        type: 'nodes_replace',
                        payload: { before, after },
                    });
                }
                resizeActiveRef.current = false;
                setRotateState(null);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', finishRotate);
            window.addEventListener('pointercancel', finishRotate);
            return () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', finishRotate);
                window.removeEventListener('pointercancel', finishRotate);
                resizeActiveRef.current = false;
            };
        }

        const { nodeId, center, originRotation, startAngle } = rotateState;
        const onMove = (e) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect || !viewportRef.current) return;
            const world = screenToWorldWithContainer(e.clientX, e.clientY, rect, viewportRef.current);
            const currentAngle = pointerWorldAngleDeg(center.x, center.y, world.x, world.y);
            const rotation = computeRotationFromPointer(
                originRotation,
                startAngle,
                currentAngle,
                e.shiftKey
            );
            collabPatchNodeRef.current(nodeId, { rotation });
        };
        const finishRotate = () => {
            const before = rotateState.beforeNode;
            const afterSnap = captureNodesSnapshot(useWhiteboardStore, [nodeId])[0];
            if (before && afterSnap?.node && JSON.stringify(before) !== JSON.stringify(afterSnap.node)) {
                useWhiteboardStore.getState().pushHistory({
                    type: 'nodes_replace',
                    payload: {
                        before: [{ id: nodeId, node: before }],
                        after: [{ id: nodeId, node: afterSnap.node }],
                    },
                });
            }
            resizeActiveRef.current = false;
            setRotateState(null);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', finishRotate);
        window.addEventListener('pointercancel', finishRotate);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finishRotate);
            window.removeEventListener('pointercancel', finishRotate);
            resizeActiveRef.current = false;
        };
    }, [collabPatchNodeRef, collabPatchNodesRef, containerRef, resizeActiveRef, rotateState, setRotateState, viewportRef]);

    const COLORABLE_TYPES = new Set(['sticky_note', 'text', 'shape', 'frame', 'comment']);

    return {
        handleResizeStart,
        handleRotateStart,
        COLORABLE_TYPES,
    };
}
