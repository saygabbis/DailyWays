import { useEffect, useRef } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, Folder, FolderOpen, MoreHorizontal, Plus, Music, Box, Star, Tag, Briefcase, BookOpen } from 'lucide-react';
import { dndKind } from '../../dnd/dndRegistry.js';

const FOLDER_ICONS = { music: Music, box: Box, star: Star, tag: Tag, briefcase: Briefcase, book: BookOpen };

/** Pasta da sidebar: reordenável, recebe itens arrastados e cria board/space direto nela. */
export default function SidebarFolder({
  group,
  itemIds,
  count,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onToggle,
  onMenu,
  onCreateInside,
  createLabel,
  isNew = false,
  children,
}) {
  const expanded = Boolean(group.isExpanded);
  const sortable = useSortable({
    id: `nav-folder:${group.id}`,
    data: { kind: 'nav-folder', groupType: group.type, groupId: group.id, title: group.title },
    disabled: isRenaming,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active } = sortable;
  const itemOver = isOver && dndKind(active) === 'nav-item';
  const Icon = FOLDER_ICONS[group.icon] || (expanded ? FolderOpen : Folder);

  // Arrastar um item por cima de uma pasta fechada abre a pasta (depois de um instante).
  const openTimer = useRef(null);
  useEffect(() => {
    if (itemOver && !expanded) {
      openTimer.current = setTimeout(() => onToggle?.(group), 550);
    }
    return () => clearTimeout(openTimer.current);
  }, [itemOver, expanded, group, onToggle]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={[
        'sb-folder dw-sortable',
        expanded ? 'is-open' : '',
        isDragging ? 'dw-drag-source' : '',
        itemOver ? 'dw-drop-target' : '',
        isNew ? 'dw-pop' : '',
      ].filter(Boolean).join(' ')}
      onContextMenu={(e) => onMenu?.(e, group)}
    >
      <div className="sb-folder-row">
        {isRenaming ? (
          <form className="sb-item-rename" onSubmit={(e) => { e.preventDefault(); onRenameSubmit?.(group.id); }}>
            <Icon size={15} className="sb-folder-icon" style={group.color ? { color: group.color } : undefined} />
            <input
              autoFocus
              aria-label="Nome da pasta"
              value={renameValue}
              onChange={(e) => onRenameChange?.(e.target.value)}
              onBlur={() => onRenameSubmit?.(group.id)}
              onKeyDown={(e) => { if (e.key === 'Escape') onRenameSubmit?.(null); }}
            />
          </form>
        ) : (
          <button
            type="button"
            className="sb-folder-main"
            aria-expanded={expanded}
            onClick={(e) => onToggle?.(group, e)}
            {...attributes}
            {...listeners}
            aria-roledescription="pasta arrastável"
          >
            <ChevronRight size={14} className="sb-chevron" aria-hidden />
            <Icon size={15} className="sb-folder-icon" style={group.color ? { color: group.color } : undefined} aria-hidden />
            <span className="sb-item-title">{group.title}</span>
            {!expanded && count > 0 && <span className="sb-count">{count}</span>}
          </button>
        )}
        {!isRenaming && (
          <span className="sb-row-actions">
            <button type="button" className="sb-item-more" aria-label={createLabel} title={createLabel} onClick={() => onCreateInside?.(group)}>
              <Plus size={15} />
            </button>
            <button type="button" className="sb-item-more" aria-label={`Opções da pasta ${group.title}`} onClick={(e) => { e.stopPropagation(); onMenu?.(e, group); }}>
              <MoreHorizontal size={15} />
            </button>
          </span>
        )}
      </div>
      {/* Fechada: os itens nem montam (senão continuariam "alvos" invisíveis do arraste). */}
      {expanded && (
        <div className="sb-folder-body">
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ul className="sb-list">
              {children}
            </ul>
          </SortableContext>
          {itemIds.length === 0 && <p className="sb-empty">Pasta vazia — arraste algo para cá</p>}
        </div>
      )}
    </li>
  );
}
