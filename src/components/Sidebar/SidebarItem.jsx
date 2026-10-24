import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Check } from 'lucide-react';

/**
 * Linha de board/space na sidebar. Arrastável (reordenar, mover para pasta) e, para boards,
 * alvo de card (soltar um card aqui move o card para este board).
 */
export default function SidebarItem({
  item,
  itemType,
  groupId,
  active = false,
  selected = false,
  selectionMode = false,
  count,
  isRenaming = false,
  renameValue = '',
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onOpen,
  onToggleSelect,
  onMenu,
  onDoubleClick,
  isNew = false,
  index = 0,
}) {
  const sortable = useSortable({
    id: `nav:${itemType}:${item.id}`,
    data: { kind: 'nav-item', itemType, itemId: item.id, groupId: groupId ?? null, title: item.title, emoji: item.emoji },
    disabled: isRenaming,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active: dragActive } = sortable;
  const cardOver = isOver && dragActive?.data?.current?.kind === 'card';

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    '--dw-i': index,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        'sb-item dw-sortable',
        active ? 'is-active' : '',
        selected ? 'is-selected' : '',
        isDragging ? 'dw-drag-source' : '',
        cardOver ? 'dw-drop-target' : '',
        isNew ? 'dw-pop' : '',
      ].filter(Boolean).join(' ')}
      onContextMenu={(e) => onMenu?.(e, item)}
    >
      {isRenaming ? (
        <form
          className="sb-item-rename"
          onSubmit={(e) => { e.preventDefault(); onRenameSubmit?.(e, item.id); }}
        >
          <span className="sb-item-emoji" aria-hidden>{item.emoji || '•'}</span>
          <input
            autoFocus
            aria-label="Novo nome"
            value={renameValue}
            onChange={(e) => onRenameChange?.(e.target.value)}
            onBlur={(e) => onRenameSubmit?.(e, item.id)}
            onKeyDown={(e) => { if (e.key === 'Escape') onRenameCancel?.(); }}
          />
        </form>
      ) : (
        <button
          type="button"
          className="sb-item-main"
          aria-current={active ? 'page' : undefined}
          onClick={(e) => onOpen?.(e, item.id)}
          onDoubleClick={() => onDoubleClick?.(item)}
          {...attributes}
          {...listeners}
          aria-roledescription="item arrastável"
        >
          {(selectionMode || selected) && (
            <span
              role="checkbox"
              aria-checked={selected}
              aria-label={`Selecionar ${item.title}`}
              tabIndex={-1}
              className={`sb-check ${selected ? 'is-on' : ''}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item); }}
            >
              {selected && <Check size={10} strokeWidth={4} />}
            </span>
          )}
          <span className="sb-item-emoji" aria-hidden style={item.color ? { '--sb-dot': item.color } : undefined}>
            {item.emoji || <span className="sb-dot" />}
          </span>
          <span className="sb-item-title">{item.title}</span>
          {count > 0 && <span className="sb-count" aria-label={`${count} tarefas`}>{count}</span>}
        </button>
      )}
      {!isRenaming && (
        <button
          type="button"
          className="sb-item-more"
          aria-label={`Opções de ${item.title}`}
          onClick={(e) => { e.stopPropagation(); onMenu?.(e, item); }}
        >
          <MoreHorizontal size={15} />
        </button>
      )}
    </li>
  );
}
