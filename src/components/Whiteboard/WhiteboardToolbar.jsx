import React, { useState } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { Undo2, Redo2, MessageSquare } from 'lucide-react';
import AssetUploader from './AssetUploader';
import CommentsPanel from './CommentsPanel';
import './WhiteboardToolbar.css';

export default function WhiteboardToolbar({ viewport, containerRef }) {
    const [showComments, setShowComments] = useState(false);
    const { undo, redo, canUndo, canRedo } = useWhiteboardStore();

    return (
        <>
            <div className="whiteboard-top-toolbar">
                <button
                    type="button"
                    className="toolbar-btn"
                    onClick={undo}
                    disabled={!canUndo()}
                    title="Desfazer"
                >
                    <Undo2 size={18} />
                </button>
                <button
                    type="button"
                    className="toolbar-btn"
                    onClick={redo}
                    disabled={!canRedo()}
                    title="Refazer"
                >
                    <Redo2 size={18} />
                </button>
                <AssetUploader viewport={viewport} containerRef={containerRef} />
                <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setShowComments((v) => !v)}
                    title="Comentários"
                >
                    <MessageSquare size={18} />
                </button>
            </div>
            {showComments && <CommentsPanel onClose={() => setShowComments(false)} />}
        </>
    );
}
