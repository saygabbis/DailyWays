import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, Plus, FolderPlus, LayoutGrid, Shapes } from 'lucide-react';
import SidebarFolder from './SidebarFolder';
import SidebarItem from './SidebarItem';
import { dndKind } from '../../dnd/dndRegistry.js';

const navId = (itemType, id) => `nav:${itemType}:${id}`;

function RootZone({ itemType, children }) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `nav-root:${itemType}`,
    data: { kind: 'nav-root', groupType: itemType, groupId: null },
  });
  const itemOver = isOver && dndKind(active) === 'nav-item';
  return (
    <div ref={setNodeRef} className={`sb-root ${itemOver ? 'dw-drop-target' : ''}`}>
      {children}
    </div>
  );
}

/** Formulário de criação inline (Enter cria, Esc/blur vazio cancela). */
function InlineCreate({ placeholder, onCreate, onCancel, indent = false }) {
  const [value, setValue] = useState('');
  return (
    <form
      className={`sb-create ${indent ? 'is-indented' : ''} dw-rise`}
      onSubmit={(e) => {
        e.preventDefault();
        const title = value.trim();
        if (title) onCreate(title);
      }}
    >
      <input
        autoFocus
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        maxLength={120}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (!value.trim()) onCancel(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      />
      <kbd className="sb-create-hint" aria-hidden>Enter</kbd>
    </form>
  );
}

/**
 * Uma seção da sidebar (Boards ou Spaces): pastas reordenáveis, itens soltos e criação rápida
 * (no cabeçalho ou direto dentro de uma pasta).
 */
export default function SidebarTree({
  itemType,
  title,
  groups,
  items,
  rootItems,
  activeId,
  selectedIds,
  selectionMode,
  recentlyAddedId,
  countFor,
  renaming,
  folderRenaming,
  onOpenItem,
  onToggleSelect,
  onItemMenu,
  onFolderMenu,
  onFolderToggle,
  onStartRename,
  onCreateItem,
  onCreateFolder,
}) {
  const [collapsed, setCollapsed] = useState(false);
  // { where: 'root' | groupId, kind: 'item' | 'folder' } enquanto o campo de criação está aberto
  const [creating, setCreating] = useState(null);
  const itemLabel = itemType === 'board' ? 'board' : 'space';
  const SectionIcon = itemType === 'board' ? LayoutGrid : Shapes;

  const renderItem = (item, index, groupId) => (
    <SidebarItem
      key={item.id}
      index={index}
      item={item}
      itemType={itemType}
      groupId={groupId}
      active={activeId === item.id}
      selected={selectedIds.includes(item.id)}
      selectionMode={selectionMode}
      count={countFor?.(item)}
      isNew={recentlyAddedId === item.id}
      isRenaming={renaming?.id === item.id}
      renameValue={renaming?.value}
      onRenameChange={renaming?.onChange}
      onRenameSubmit={renaming?.onSubmit}
      onRenameCancel={renaming?.onCancel}
      onOpen={onOpenItem}
      onToggleSelect={onToggleSelect}
      onMenu={onItemMenu}
      onDoubleClick={onStartRename}
    />
  );

  return (
    <section className={`sb-section ${collapsed ? 'is-collapsed' : ''}`} aria-label={title}>
      <header className="sb-section-head">
        <button
          type="button"
          className="sb-section-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          <SectionIcon size={13} aria-hidden />
          <span>{title}</span>
          <ChevronDown size={13} className="sb-section-chevron" aria-hidden />
        </button>
        <span className="sb-section-actions">
          <button type="button" className="sb-icon-btn" title="Nova pasta" aria-label="Nova pasta" onClick={() => { setCollapsed(false); setCreating({ where: 'root', kind: 'folder' }); }}>
            <FolderPlus size={15} />
          </button>
          <button type="button" className="sb-icon-btn" title={`Novo ${itemLabel}`} aria-label={`Novo ${itemLabel}`} onClick={() => { setCollapsed(false); setCreating({ where: 'root', kind: 'item' }); }}>
            <Plus size={16} />
          </button>
        </span>
      </header>

      {!collapsed && (
        <div className="sb-section-body">
          {creating?.where === 'root' && (
            <InlineCreate
              placeholder={creating.kind === 'folder' ? 'Nome da pasta…' : `Nome do ${itemLabel}…`}
              onCancel={() => setCreating(null)}
              onCreate={(name) => {
                setCreating(null);
                if (creating.kind === 'folder') onCreateFolder?.(name);
                else onCreateItem?.(name, null);
              }}
            />
          )}

          <SortableContext items={groups.map((g) => `nav-folder:${g.id}`)} strategy={verticalListSortingStrategy}>
            <ul className="sb-list">
              {groups.map((group) => {
                const inside = items.filter((i) => i.groupId === group.id).sort((a, b) => a.position - b.position);
                return (
                  <SidebarFolder
                    key={group.id}
                    group={group}
                    itemIds={inside.map((i) => navId(itemType, i.id))}
                    count={inside.length}
                    isNew={recentlyAddedId === group.id}
                    isRenaming={folderRenaming?.id === group.id}
                    renameValue={folderRenaming?.value}
                    onRenameChange={folderRenaming?.onChange}
                    onRenameSubmit={folderRenaming?.onSubmit}
                    onToggle={onFolderToggle}
                    onMenu={onFolderMenu}
                    createLabel={`Novo ${itemLabel} nesta pasta`}
                    onCreateInside={(g) => {
                      if (!g.isExpanded) onFolderToggle?.(g);
                      setCreating({ where: g.id, kind: 'item' });
                    }}
                  >
                    {creating?.where === group.id && (
                      <li>
                        <InlineCreate
                          indent
                          placeholder={`Nome do ${itemLabel}…`}
                          onCancel={() => setCreating(null)}
                          onCreate={(name) => { setCreating(null); onCreateItem?.(name, group.id); }}
                        />
                      </li>
                    )}
                    {inside.map((item, index) => renderItem(item, index, group.id))}
                  </SidebarFolder>
                );
              })}
            </ul>
          </SortableContext>

          <RootZone itemType={itemType}>
            <SortableContext items={rootItems.map((i) => navId(itemType, i.id))} strategy={verticalListSortingStrategy}>
              <ul className="sb-list">
                {rootItems.map((item, index) => renderItem(item, index, null))}
              </ul>
            </SortableContext>
            {!groups.length && !rootItems.length && !creating && (
              <button type="button" className="sb-empty-cta" onClick={() => setCreating({ where: 'root', kind: 'item' })}>
                <Plus size={14} /> Criar o primeiro {itemLabel}
              </button>
            )}
          </RootZone>
        </div>
      )}
    </section>
  );
}
