/** Ações sobre a seleção: menu de contexto, baixar imagens, apagar e trocar cor. */
import { useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { deleteNode as deleteNodeService } from '../../../../services/whiteboardService';
import { resolveDragNodeIds } from '../../core/selection/whiteboardSelectionUtils';
import { getSelectionContextFlags } from '../../core/layers/whiteboardGroupOps';
import { contrastingTextColor } from '../../../../utils/contrastingTextColor';
import { recordNodesMutation } from '../../core/history/whiteboardHistory';

export function useSelectionActions(ctx) {
    const {
        setContextMenuPosition,
        collabPatchNode,
        collabDeleteNodes,
        collabConnected,
        setSelection,
        handleDeleteSelectedGuides,
        COLORABLE_TYPES,
    } = ctx;

    const openSelectionContextMenu = useCallback((clientX, clientY) => {
        const st = useWhiteboardStore.getState();
        const prunedIds = resolveDragNodeIds(st.selectedNodeIds, st.nodes, {
            groupDrill: st.groupDrill,
            isolateSelection: st.isolateSelection,
        });
        const { canGroup, canUngroup } = getSelectionContextFlags(st.nodes, st.selectedNodeIds);
        const showColorPicker = st.nodes.some(
            (n) => prunedIds.includes(n.id) && COLORABLE_TYPES.has(n.type)
        );
        const showDownloadImage = st.nodes.some(
            (n) => prunedIds.includes(n.id) && n.type === 'image' && n.data?.url
        );
        setContextMenuPosition({
            left: clientX,
            top: clientY,
            mode: 'selection',
            canGroup,
            canUngroup,
            showColorPicker,
            showDownloadImage,
        });
    }, []);

    const handleDownloadSelectedImages = useCallback(() => {
        const st = useWhiteboardStore.getState();
        const ids = resolveDragNodeIds(st.selectedNodeIds, st.nodes, {
            groupDrill: st.groupDrill,
            isolateSelection: st.isolateSelection,
        });
        const images = st.nodes.filter(
            (n) => ids.includes(n.id) && n.type === 'image' && n.data?.url
        );
        for (const node of images) {
            const a = document.createElement('a');
            a.href = node.data.url;
            a.download = node.data.filename || 'imagem';
            a.rel = 'noopener noreferrer';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
    }, []);

    const handleDeleteSelection = useCallback(async () => {
        if (useWhiteboardSelectionStore.getState().selectedGuideIds.length) {
            await handleDeleteSelectedGuides();
            return;
        }
        const state = useWhiteboardStore.getState();
        const ids = resolveDragNodeIds(state.selectedNodeIds, state.nodes, {
            groupDrill: state.groupDrill,
            isolateSelection: state.isolateSelection,
        });
        if (!ids.length) return;
        const selectedNodes = state.nodes.filter((n) => ids.includes(n.id));
        useWhiteboardStore.getState().pushHistory({
            type: 'node_delete',
            payload: { nodes: selectedNodes.map((n) => JSON.parse(JSON.stringify(n))) },
        });
        if (!collabConnected) {
            for (const id of ids) {
                deleteNodeService(id);
            }
        }
        collabDeleteNodes(ids);
        setSelection([]);
    }, [collabConnected, collabDeleteNodes, setSelection, handleDeleteSelectedGuides]);

    const handleSelectionColor = useCallback(
        (color) => {
            const state = useWhiteboardStore.getState();
            const ids = resolveDragNodeIds(state.selectedNodeIds, state.nodes, {
                groupDrill: state.groupDrill,
                isolateSelection: state.isolateSelection,
            });
            const selected = state.nodes.filter((n) => ids.includes(n.id));
            if (!selected.length) return;
            recordNodesMutation(useWhiteboardStore, ids, () => {
                selected.forEach((n) => {
                    const style = { ...n.style, backgroundColor: color, fill: color };
                    if (n.type === 'sticky_note') {
                        style.color = contrastingTextColor(color);
                    }
                    collabPatchNode(n.id, { style });
                });
            });
        },
        [collabPatchNode]
    );

    const handleNodeContextMenu = useCallback(
        (e, nodeId) => {
            e.preventDefault();
            e.stopPropagation();
            const st = useWhiteboardStore.getState();
            if (!st.selectedNodeIds.includes(nodeId)) {
                setSelection([nodeId]);
            }
            openSelectionContextMenu(e.clientX, e.clientY);
        },
        [openSelectionContextMenu, setSelection]
    );

    return {
        openSelectionContextMenu,
        handleDownloadSelectedImages,
        handleDeleteSelection,
        handleSelectionColor,
        handleNodeContextMenu,
    };
}
