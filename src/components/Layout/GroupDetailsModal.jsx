import { useEffect, useMemo, useState } from 'react';
import { X, Palette, CheckCircle, Music, Box, Star, Tag, Briefcase, BookOpen, Folder } from 'lucide-react';
import './GroupDetailsModal.css';

const GROUP_COLOR_PRESETS = [
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

const ICON_PRESETS = [
  { id: null, label: 'Sem ícone extra', Icon: null },
  { id: 'music', label: 'Música', Icon: Music },
  { id: 'box', label: 'Caixa', Icon: Box },
  { id: 'star', label: 'Favoritos', Icon: Star },
  { id: 'tag', label: 'Tags', Icon: Tag },
  { id: 'briefcase', label: 'Trabalho', Icon: Briefcase },
  { id: 'book', label: 'Estudos', Icon: BookOpen },
];

export default function GroupDetailsModal({ group, onSave, onClose }) {
  const [title, setTitle] = useState(group?.title ?? '');
  const [color, setColor] = useState(group?.color ?? null);
  const [icon, setIcon] = useState(group?.icon ?? null);

  useEffect(() => {
    setTitle(group?.title ?? '');
    setColor(group?.color ?? null);
    setIcon(group?.icon ?? null);
  }, [group]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const iconOptions = useMemo(() => ICON_PRESETS, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      title: title.trim() || group.title,
      color: color || null,
      icon: icon || null,
    });
    onClose();
  };

  if (!group) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="group-details-modal animate-scale-in-centered" onClick={(e) => e.stopPropagation()}>
        <div className="group-details-header">
          <h2>Detalhes da pasta</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="group-details-body">
          <label className="group-details-field">
            <span>Nome da pasta</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Projetos"
            />
          </label>

          <label className="group-details-field">
            <span><Palette size={16} /> Cor da pasta</span>
            <div className="group-details-colors">
              {GROUP_COLOR_PRESETS.map((c) => (
                <button
                  key={c ?? 'none'}
                  type="button"
                  className={`group-details-color-chip ${color === c ? 'active' : ''} ${!c ? 'group-details-color-none' : ''}`}
                  style={c ? { background: c } : {}}
                  title={c ? c : 'Sem cor'}
                  onClick={() => setColor(c)}
                >
                  {color === c && <CheckCircle size={14} color={c ? '#fff' : 'var(--text-secondary)'} />}
                </button>
              ))}
            </div>
          </label>

          <div className="group-details-field">
            <span>Ícone da pasta</span>
            <div className="group-details-icons">
              {iconOptions.map((opt) => {
                const ActiveIcon = opt.Icon;
                const isActive = icon === opt.id;
                return (
                  <button
                    key={opt.id ?? 'none'}
                    type="button"
                    className={`group-details-icon-chip ${isActive ? 'active' : ''}`}
                    title={opt.label}
                  onClick={() => setIcon(opt.id)}
                  >
                    {ActiveIcon ? <ActiveIcon size={16} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="group-details-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </>
  );
}

