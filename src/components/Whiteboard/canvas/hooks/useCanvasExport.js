/**
 * Exportar como PNG: seleção (um frame selecionado = o frame com o conteúdo) ou a página inteira.
 * Os nós fora da tela não são montados (culling), então a câmera enquadra o alvo, captura
 * o DOM do canvas sem a escala da câmera e volta para onde estava.
 */
import { useCallback } from 'react';
import { useWhiteboardStore } from '../../../../stores/whiteboardStore';
import { useWhiteboardSelectionStore } from '../../../../stores/whiteboardSelectionStore';
import { filterNodesByPage } from '../../core/pages/whiteboardPages';
import { buildNodesById, nodeToWorld } from '../../core/nodeGeometry';
import { computeViewportToFitNodes } from '../../interaction/viewport/viewportFit';

const EXPORT_PADDING = 24;
const MAX_EXPORT_PX = 8192;
/** Camadas do canvas que não são conteúdo. */
const SKIP_CLASSES = ['whiteboard-snap-guides', 'whiteboard-ruler-guides-layer', 'whiteboard-freehand-preview'];

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function descendantsOf(ids, nodes) {
    const out = new Set(ids);
    let grew = true;
    while (grew) {
        grew = false;
        for (const n of nodes) {
            if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
                out.add(n.id);
                grew = true;
            }
        }
    }
    return out;
}

function slug(text) {
    return (text || 'space').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'space';
}

export function useCanvasExport({ containerRef, viewportState, spaceTitle, addToast }) {
    return useCallback(async (mode = 'auto') => {
        const st = useWhiteboardStore.getState();
        const pageNodes = filterNodesByPage(st.nodes, st.activePageId);
        const byId = buildNodesById(pageNodes);
        const selected = st.selectedNodeIds.filter((id) => byId.has(id));
        const useSelection = mode === 'selection' || (mode === 'auto' && selected.length > 0);
        const targets = useSelection ? selected.map((id) => byId.get(id)) : pageNodes.filter((n) => !n.parentId);
        if (!targets.length) {
            addToast?.('Nada para exportar nesta página.', 'info');
            return;
        }
        const include = useSelection ? descendantsOf(selected, pageNodes) : null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of targets) {
            const p = nodeToWorld(n, byId);
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + (n.width ?? 0));
            maxY = Math.max(maxY, p.y + (n.height ?? 0));
        }
        minX -= EXPORT_PADDING;
        minY -= EXPORT_PADDING;
        const width = Math.ceil(maxX + EXPORT_PADDING - minX);
        const height = Math.ceil(maxY + EXPORT_PADDING - minY);

        const viewportEl = containerRef.current;
        const transformEl = viewportEl?.querySelector('.whiteboard-canvas-transform');
        const rect = viewportEl?.getBoundingClientRect();
        if (!transformEl || !rect) return;

        const before = { pan: { ...viewportState.pan }, zoom: viewportState.zoom };
        const selectionBefore = st.selectedNodeIds;
        const fit = computeViewportToFitNodes([{ x: minX, y: minY, width, height }], rect, 0);
        useWhiteboardSelectionStore.getState().setSelection?.([]); // sem contorno de seleção na imagem
        viewportState.setViewport(fit.pan, fit.zoom);
        addToast?.('Gerando imagem…', 'info');
        try {
            await nextFrame();
            await nextFrame();
            await new Promise((r) => setTimeout(r, 120));
            // Captura o viewport como está (câmera enquadrando o alvo) numa resolução que dê
            // ~2 px por unidade de mundo, e recorta o retângulo do alvo.
            const { toCanvas } = await import('html-to-image');
            const z = fit.zoom;
            const targetScale = Math.min(2, MAX_EXPORT_PX / Math.max(width, height));
            const ratio = Math.min(targetScale / z, 16384 / Math.max(rect.width, rect.height));
            const full = await toCanvas(viewportEl, {
                pixelRatio: ratio,
                backgroundColor: getComputedStyle(viewportEl).backgroundColor,
                style: { backgroundImage: 'none' }, // sem a grade de pontos
                filter: (el) => {
                    if (el === viewportEl) return true;
                    const cls = el.classList;
                    if (!cls) return true;
                    // só o conteúdo do mundo (sem barras, réguas, presença, alças de seleção)
                    if (!cls.contains('whiteboard-canvas-transform') && !el.closest?.('.whiteboard-canvas-transform')) return false;
                    if (SKIP_CLASSES.some((c) => cls.contains(c))) return false;
                    if (include && cls.contains('whiteboard-node-wrapper') && !include.has(el.dataset.nodeId)) return false;
                    if (include && el.dataset?.connectorFrom) {
                        return include.has(el.dataset.connectorFrom) && include.has(el.dataset.connectorTo);
                    }
                    return true;
                },
            });
            const sx = (rect.width / 2 + fit.pan.x + minX * z) * ratio;
            const sy = (rect.height / 2 + fit.pan.y + minY * z) * ratio;
            const sw = width * z * ratio;
            const sh = height * z * ratio;
            const out = document.createElement('canvas');
            out.width = Math.max(1, Math.round(sw));
            out.height = Math.max(1, Math.round(sh));
            out.getContext('2d').drawImage(full, sx, sy, sw, sh, 0, 0, out.width, out.height);
            const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
            if (!blob) throw new Error('sem imagem');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${slug(spaceTitle)}-${useSelection ? 'selecao' : 'pagina'}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (err) {
            console.warn('[export] falhou', err);
            addToast?.('Não foi possível gerar a imagem.', 'error');
        } finally {
            viewportState.setViewport(before.pan, before.zoom);
            useWhiteboardSelectionStore.getState().setSelection?.(selectionBefore);
        }
    }, [containerRef, viewportState, spaceTitle, addToast]);
}
