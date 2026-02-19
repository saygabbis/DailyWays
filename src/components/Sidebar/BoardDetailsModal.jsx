import { useState, useEffect } from 'react';
import { X, Save, Palette, Smile } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './BoardDetailsModal.css';

export default function BoardDetailsModal({ board, onClose }) {
    const { updateBoardAndPersist, DEFAULT_BOARD_COLORS } = useApp();
    const [title, setTitle] = useState(board.title);
    const [emoji, setEmoji] = useState(board.emoji);
    const [color, setColor] = useState(board.color);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        await updateBoardAndPersist(board.id, { title, emoji, color });
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 1000);
    };

    // Close on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-content board-details-modal animate-scale-in">
                <div className="modal-header">
                    <h3>Detalhes do Board</h3>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <div className="settings-field">
                        <label>Título</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Nome do board"
                        />
                    </div>

                    <div className="settings-field">
                        <label>Emoji</label>
                        <input
                            type="text"
                            value={emoji}
                            onChange={e => {
                                const val = e.target.value;
                                if (val.length > 0) {
                                    const chars = Array.from(val);
                                    setEmoji(chars[chars.length - 1]);
                                } else {
                                    setEmoji('');
                                }
                            }}
                            placeholder="🚀"
                            maxLength={10}
                        />
                        <p className="settings-field-hint">O novo emoji substituirá o atual automaticamente.</p>
                    </div>

                    <div className="settings-field">
                        <label>Cor do Board</label>
                        <div className="settings-accent-grid">
                            {DEFAULT_BOARD_COLORS.map((c, i) => (
                                <button
                                    key={i}
                                    className={`settings-accent-btn ${color === c ? 'active' : ''}`}
                                    onClick={() => setColor(c)}
                                    style={{ background: c }}
                                >
                                    {color === c && <div className="active-check">✓</div>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={16} />
                        {saved ? 'Salvo!' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </>
    );
}
