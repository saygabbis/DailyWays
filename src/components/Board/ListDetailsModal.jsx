import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Palette, CheckCircle } from 'lucide-react';
import { useCollabPresence } from '../../collab/board/presence/useCollabPresence.js';
import { useDocumentPointerPresence } from '../../collab/board/presence/useDocumentPointerPresence.js';
import {
    pointerCoordsFromOverlayScrollEvent,
} from '../../collab/board/coords/overlayScrollCursorCoords.js';
import { applyTaskModalPresence } from '../../collab/board/presence/boardPresenceFocus.js';
import { announcePresence } from '../../collab/board/presence/presenceBridge.js';
import { isPeerInBoardOverlay } from '../../collab/board/presence/presenceVisibility.js';
import CollabPresenceLayer from '../../collab/board/ui/CollabPresenceLayer.jsx';
import { useCollab } from '../../collab/core/CollabContext.jsx';
import { isCollabEnabled } from '../../collab/core/collabConfig.js';
import './ListDetailsModal.css';

const LIST_COLOR_PRESETS = [
    null,
    '#6b7280',
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
];

export default function ListDetailsModal({ list, boardId, onSave, onClose }) {
    const collab = useCollab();
    const modalRef = useRef(null);
    const [scrollRepaint, setScrollRepaint] = useState(0);
    const { updateCursor } = useCollabPresence(boardId, { mode: 'screen' });
    const [title, setTitle] = useState(list?.title ?? '');
    const [color, setColor] = useState(list?.color ?? null);
    const [isCompletionList, setIsCompletionList] = useState(list?.isCompletionList ?? false);

    useEffect(() => {
        if (!boardId || !isCollabEnabled()) return undefined;
        applyTaskModalPresence(boardId);
        announcePresence(boardId);
        return () => announcePresence(boardId);
    }, [boardId]);

    const getListPointerCoords = useCallback(
        (e) => pointerCoordsFromOverlayScrollEvent(e, modalRef.current, '.list-details-body'),
        [],
    );

    useEffect(() => {
        const root = modalRef.current;
        if (!root) return undefined;
        const bump = () => setScrollRepaint((n) => n + 1);
        const scrollEl = root.querySelector('.list-details-body');
        if (scrollEl) scrollEl.addEventListener('scroll', bump, { passive: true });
        const ro = new ResizeObserver(bump);
        ro.observe(root);
        window.addEventListener('resize', bump, { passive: true });
        return () => {
            if (scrollEl) scrollEl.removeEventListener('scroll', bump);
            ro.disconnect();
            window.removeEventListener('resize', bump);
        };
    }, [list?.id]);

    useDocumentPointerPresence({
        enabled: Boolean(boardId && collab?.connected && isCollabEnabled()),
        updateCursor,
        getCoords: getListPointerCoords,
    });

    useEffect(() => {
        setTitle(list?.title ?? '');
        setColor(list?.color ?? null);
        setIsCompletionList(list?.isCompletionList ?? false);
    }, [list]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ title: title.trim() || list.title, color: color || null, isCompletionList });
        onClose();
    };

    if (!list) return null;

    return createPortal(
        <>
            {collab?.connected && isCollabEnabled() && (
                <CollabPresenceLayer
                    mode="screen"
                    elevated
                    modalRootRef={modalRef}
                    overlayScrollSelector=".list-details-body"
                    scrollRepaint={scrollRepaint}
                    layoutRepaint={scrollRepaint}
                    peerFilter={isPeerInBoardOverlay}
                />
            )}
            <div className="modal-backdrop" onClick={onClose} />
            <div
                ref={modalRef}
                className="list-details-modal animate-scale-in-centered"
                onClick={e => e.stopPropagation()}
            >
                <div className="list-details-header">
                    <h2>Detalhes da lista</h2>
                    <button type="button" className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="list-details-body">
                    <label className="list-details-field">
                        <span>Nome da lista</span>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ex: A Fazer"
                        />
                    </label>

                    <label className="list-details-field">
                        <span><Palette size={16} /> Cor da lista</span>
                        <div className="list-details-colors">
                            {LIST_COLOR_PRESETS.map((c) => (
                                <button
                                    key={c ?? 'none'}
                                    type="button"
                                    className={`list-details-color-chip ${color === c ? 'active' : ''} ${!c ? 'list-details-color-none' : ''}`}
                                    style={c ? { background: c } : {}}
                                    title={c ? c : 'Sem cor'}
                                    onClick={() => setColor(c)}
                                >
                                    {color === c && <CheckCircle size={14} color={c ? '#fff' : 'var(--text-secondary)'} />}
                                </button>
                            ))}
                        </div>
                    </label>

                    <div className="list-details-row">
                        <div className="list-details-info">
                            <span className="list-details-checkbox-label"><CheckCircle size={16} /> Lista de conclusão</span>
                            <p className="list-details-hint">
                                Cards nesta lista são marcados como concluídos automaticamente no Overview e busca.
                            </p>
                        </div>
                        <label className="list-toggle-switch">
                            <input
                                type="checkbox"
                                checked={isCompletionList}
                                onChange={e => setIsCompletionList(e.target.checked)}
                            />
                            <span className="list-toggle-slider" />
                        </label>
                    </div>

                    <div className="list-details-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
}
