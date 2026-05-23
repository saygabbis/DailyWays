import { useEffect } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { computeViewportToFitNodes } from '../viewport/viewportFit';
import {
    copyNodesToClipboard,
    nudgeSelectedNodes,
    patchZIndexSelected,
} from '../../core/ops/whiteboardNodeOps';
import {
    groupSelectedNodes,
    ungroupSelectedNodes,
} from '../../core/layers/whiteboardGroupOps';
import { deleteNode as deleteNodeService } from '../../../../services/whiteboardService';

export function useCanvasShortcuts({
    containerRef,
    collabConnected,
    collabDeleteNodes,
    collabPatchNodes,
    performUndo,
    performRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handlePasteInPlace,
    handleDuplicate,
    setRulersVisible,
    setGridVisible,
    setActiveTool,
    setConnectorFromNodeId,
    viewportState,
    getZoomFocalClient,
    commitTextEdit,
    setIsSpacePressed,
    setShortcutsHelpOpen,
    setContextMenuPosition,
}) {
    useEffect(() => {
        const isEditableTarget = () => {
            const el = document.activeElement;
            if (!el) return false;
            const tag = el.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
                return true;
            }
            return false;
        };

        const isSpaceUiTextFocus = () => {
            const el = document.activeElement;
            if (!el || !isEditableTarget()) return false;
            if (el.closest?.('.whiteboard-node-wrapper')) return false;
            if (el.closest?.('.whiteboard-floating-toolbar')) return false;
            return true;
        };

        const isEditingWhiteboardText = () => {
            const el = document.activeElement;
            if (!el) return false;
            if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') return false;
            return !!el.closest?.('.whiteboard-node-wrapper');
        };

        const shouldHandleCanvasShortcut = () =>
            !isEditingWhiteboardText() && !isSpaceUiTextFocus();

        const onKeyDown = (e) => {
            if (e.key === ' ') {
                if (!shouldHandleCanvasShortcut()) return;
                e.preventDefault();
                setIsSpacePressed(true);
                return;
            }

            const mod = e.ctrlKey || e.metaKey;
            const keyLower = e.key.toLowerCase();

            if (mod) {
                if (keyLower === 'r') {
                    if (!shouldHandleCanvasShortcut()) return;
                    e.preventDefault();
                    setRulersVisible(!useWhiteboardStore.getState().rulersVisible);
                    return;
                }
                if (shouldHandleCanvasShortcut()) {
                    if (keyLower === 'g') {
                        e.preventDefault();
                        if (e.shiftKey) {
                            ungroupSelectedNodes(useWhiteboardStore, collabPatchNodes, collabDeleteNodes);
                        } else {
                            groupSelectedNodes(useWhiteboardStore, collabPatchNodes);
                        }
                        return;
                    }
                    if (keyLower === 'z') {
                        e.preventDefault();
                        if (e.shiftKey) performRedo();
                        else performUndo();
                        return;
                    }
                    if (keyLower === 'y') {
                        e.preventDefault();
                        performRedo();
                        return;
                    }
                    if (keyLower === 'x') {
                        e.preventDefault();
                        handleCut();
                        return;
                    }
                    if (keyLower === 'c') {
                        e.preventDefault();
                        handleCopy();
                        return;
                    }
                    if (keyLower === 'v' || e.code === 'KeyV') {
                        e.preventDefault();
                        if (e.shiftKey) handlePasteInPlace();
                        else handlePaste();
                        return;
                    }
                    if (keyLower === 'd' || e.code === 'KeyD') {
                        e.preventDefault();
                        handleDuplicate();
                        return;
                    }
                    if (keyLower === 'a') {
                        e.preventDefault();
                        const st = useWhiteboardStore.getState();
                        st.setSelection(st.nodes.map((n) => n.id));
                        return;
                    }
                    if (keyLower === '0') {
                        e.preventDefault();
                        viewportState.setViewport({ x: 0, y: 0 }, 1);
                        return;
                    }
                    if (keyLower === '1') {
                        e.preventDefault();
                        const rect = containerRef.current?.getBoundingClientRect();
                        const st = useWhiteboardStore.getState();
                        const target =
                            st.selectedNodeIds.length > 0
                                ? st.nodes.filter((n) => st.selectedNodeIds.includes(n.id))
                                : st.nodes;
                        const fit = computeViewportToFitNodes(target, rect);
                        viewportState.setViewport(fit.pan, fit.zoom);
                        return;
                    }
                    if (keyLower === '=' || keyLower === '+') {
                        e.preventDefault();
                        const { x, y } = getZoomFocalClient();
                        viewportState.zoomAtClient(x, y, 1.2);
                        return;
                    }
                    if (keyLower === '-') {
                        e.preventDefault();
                        const { x, y } = getZoomFocalClient();
                        viewportState.zoomAtClient(x, y, 1 / 1.2);
                        return;
                    }
                    if (e.key === ']') {
                        e.preventDefault();
                        patchZIndexSelected(
                            useWhiteboardStore,
                            collabPatchNodes,
                            e.shiftKey ? 'front' : 'forward'
                        );
                        return;
                    }
                    if (e.key === '[') {
                        e.preventDefault();
                        patchZIndexSelected(
                            useWhiteboardStore,
                            collabPatchNodes,
                            e.shiftKey ? 'back' : 'backward'
                        );
                        return;
                    }
                }
            }

            if (e.shiftKey && !mod && e.key === '1') {
                if (!shouldHandleCanvasShortcut()) return;
                e.preventDefault();
                const rect = containerRef.current?.getBoundingClientRect();
                const st = useWhiteboardStore.getState();
                const target =
                    st.selectedNodeIds.length > 0
                        ? st.nodes.filter((n) => st.selectedNodeIds.includes(n.id))
                        : st.nodes;
                const fit = computeViewportToFitNodes(target, rect);
                viewportState.setViewport(fit.pan, fit.zoom);
                return;
            }

            if (e.key === 'Escape') {
                const st = useWhiteboardStore.getState();
                if (st.editingNodeId) {
                    commitTextEdit();
                    return;
                }
                if (st.connectorFromNodeId) {
                    st.setConnectorFromNodeId(null);
                    return;
                }
                if (st.selectedNodeIds.length || st.activeTool !== 'select') {
                    e.preventDefault();
                    st.setSelection([]);
                    st.setActiveTool('select');
                    setContextMenuPosition(null);
                }
                return;
            }

            if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                if (shouldHandleCanvasShortcut()) {
                    e.preventDefault();
                    setShortcutsHelpOpen((v) => !v);
                    return;
                }
            }

            if (
                !mod &&
                !e.altKey &&
                ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)
            ) {
                if (shouldHandleCanvasShortcut()) {
                    const st = useWhiteboardStore.getState();
                    if (st.selectedNodeIds.length) {
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const dx = keyLower === 'arrowleft' ? -step : keyLower === 'arrowright' ? step : 0;
                        const dy = keyLower === 'arrowup' ? -step : keyLower === 'arrowdown' ? step : 0;
                        nudgeSelectedNodes(useWhiteboardStore, collabPatchNodes, dx, dy);
                        return;
                    }
                }
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (isSpaceUiTextFocus()) return;
                const state = useWhiteboardStore.getState();
                if (state.editingNodeId) return;
                if (!state.selectedNodeIds.length) return;
                e.preventDefault();
                const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
                state.pushHistory({
                    type: 'node_delete',
                    payload: { nodes: selectedNodes.map((n) => ({ ...n })) },
                });
                if (!collabConnected) {
                    for (const id of state.selectedNodeIds) {
                        deleteNodeService(id);
                    }
                }
                collabDeleteNodes(state.selectedNodeIds);
                state.setSelection([]);
                return;
            }

            if (!mod && !e.altKey && e.key.length === 1 && shouldHandleCanvasShortcut()) {
                const toolByKey = {
                    v: 'select',
                    t: 'text',
                    s: 'sticky_note',
                    r: 'shape',
                    f: 'frame',
                    l: 'connector',
                    p: 'draw',
                    m: 'comment',
                    g: null,
                };
                const tool = toolByKey[keyLower];
                if (keyLower === 'g') {
                    e.preventDefault();
                    const st = useWhiteboardStore.getState();
                    setGridVisible(!st.gridVisible);
                    return;
                }
                if (tool) {
                    e.preventDefault();
                    setActiveTool(tool);
                    if (tool === 'connector') setConnectorFromNodeId(null);
                    return;
                }
            }

            if (mod || e.altKey) return;
            if (e.key.length !== 1) return;
            if (isSpaceUiTextFocus()) return;

            const state = useWhiteboardStore.getState();
            if (state.editingNodeId) return;
            if (state.selectedNodeIds.length !== 1) return;

            const node = state.nodes.find((n) => n.id === state.selectedNodeIds[0]);
            if (!node || (node.type !== 'text' && node.type !== 'sticky_note' && node.type !== 'link')) return;

            e.preventDefault();
            state.setEditingNodeId(node.id);
            state.setEditTypingSeed(e.key);
        };
        const onKeyUp = (e) => {
            if (e.key === ' ') {
                setIsSpacePressed(false);
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [
        collabConnected,
        collabDeleteNodes,
        collabPatchNodes,
        performUndo,
        performRedo,
        handleCut,
        handleCopy,
        handlePaste,
        handlePasteInPlace,
        handleDuplicate,
        setRulersVisible,
        setGridVisible,
        setActiveTool,
        setConnectorFromNodeId,
        viewportState,
        getZoomFocalClient,
        commitTextEdit,
        containerRef,
        setIsSpacePressed,
        setShortcutsHelpOpen,
        setContextMenuPosition,
    ]);
}
