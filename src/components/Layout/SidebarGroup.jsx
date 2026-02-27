import React, { useRef, useEffect, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Folder, FolderOpen, MoreHorizontal, Check, Music, Box, Star, Tag, Briefcase, BookOpen } from 'lucide-react';

export default function SidebarGroup({ group, index, items, activeView, activeBoard, onContextMenu, onToggleSelection, selectedItems = [], isDraggingBulk = false, onRename, onClickItem, onHeaderClick, renderItem, editingGroupId, editGroupTitle, setEditGroupTitle, onRenameSubmit, isLastGroup = false, isJustReordered = false }) {
    // Folders should always be toggleable. We just consider it "visually closed" if it's explicitly collapsed.
    const effectiveIsExpanded = Boolean(group.isExpanded);
    const isEditing = editingGroupId === group.id;
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const hasSelectedItems = items.length > 0 && items.every(i => selectedItems?.includes(i.id));
    const isFolderItselfSelected = selectedItems?.includes(group.id);
    const IconForGroup = useMemo(() => {
        const map = {
            music: Music,
            box: Box,
            star: Star,
            tag: Tag,
            briefcase: Briefcase,
            book: BookOpen,
        };
        return group?.icon ? map[group.icon] ?? null : null;
    }, [group?.icon]);

    return (
        <Draggable draggableId={group.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`sidebar-group ${snapshot.isDragging ? 'dragging' : ''} ${group._isNew ? 'group-new' : ''}`}
                >
                    <div className={`sidebar-group-inner ${isJustReordered ? 'sidebar-jelly-reorder' : ''}`}>
                    <Droppable droppableId={`group-${group.id}`} type={group.type}>
                        {(dropProvided, dropSnapshot) => {
                            const showContent = effectiveIsExpanded || dropSnapshot.isDraggingOver;
                            return (
                                <div
                                    ref={dropProvided.innerRef}
                                    {...dropProvided.droppableProps}
                                    className={`sidebar-group-droppable ${dropSnapshot.isDraggingOver ? 'group-drag-over' : ''} ${isLastGroup ? 'sidebar-group-droppable-last' : ''}`}
                                >
                                    {/* Folder Header */}
                                    <div
                                        className={`sidebar-group-header sidebar-item group-header-item ${hasSelectedItems && !isFolderItselfSelected ? 'contents-selected' : ''} ${isFolderItselfSelected ? 'selected-item' : ''}`}
                                        {...provided.dragHandleProps}
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => !isEditing && (onHeaderClick ? onHeaderClick(e, group) : onClickItem(group))}
                                        onContextMenu={(e) => onContextMenu(e, group)}
                                        onDoubleClick={(e) => { e.stopPropagation(); onRename && onRename(group); }}
                                    >
                                        <div
                                            className={`sidebar-board-checkbox ${isFolderItselfSelected ? 'selected' : ''} ${hasSelectedItems && !isFolderItselfSelected ? 'contents-selected-checkbox' : ''}`}
                                            title="Selecionar"
                                            onClick={(e) => { e.stopPropagation(); onToggleSelection(e); }}
                                        >
                                            {isFolderItselfSelected && <Check size={10} strokeWidth={4} />}
                                            {hasSelectedItems && !isFolderItselfSelected && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '11px', fontWeight: 800 }}>–</span>}
                                        </div>

                                        {/* Cor da pasta aplicada direto no ícone principal */}
                                        <span
                                            className="sidebar-group-icon"
                                            style={group.color ? { color: group.color } : undefined}
                                        >
                                            {effectiveIsExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                                        </span>

                                        {IconForGroup ? (
                                            <span className="sidebar-group-custom-icon" title="Ícone da pasta">
                                                <IconForGroup size={14} />
                                            </span>
                                        ) : null}

                                        {isEditing ? (
                                            <form onSubmit={(e) => { e.preventDefault(); onRenameSubmit(group.id); }} className="sidebar-rename-form" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    ref={inputRef}
                                                    value={editGroupTitle}
                                                    onChange={e => setEditGroupTitle(e.target.value)}
                                                    onBlur={() => onRenameSubmit(group.id)}
                                                    onKeyDown={e => e.key === 'Escape' && onRenameSubmit(null)}
                                                />
                                            </form>
                                        ) : (
                                            <span className="truncate" style={{ fontWeight: 600 }}>{group.title}</span>
                                        )}

                                        <div
                                            className="board-drag-indicator"
                                            title="Opções da pasta"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onContextMenu(e, group);
                                            }}
                                        >
                                            <MoreHorizontal size={14} className="rotate-90" />
                                        </div>
                                    </div>

                                    {/* Droppable Area for items inside this folder */}
                                    <div
                                        className="sidebar-group-content"
                                        style={{
                                            height: showContent ? 'auto' : 0,
                                            overflow: showContent ? 'visible' : 'hidden',
                                            opacity: showContent ? 1 : 0,
                                            pointerEvents: showContent ? 'auto' : 'none',
                                            minHeight: showContent ? '26px' : 0,
                                            paddingTop: showContent ? undefined : 0,
                                            paddingBottom: showContent ? undefined : 0,
                                            marginTop: showContent ? undefined : 0,
                                            marginBottom: showContent ? undefined : 0,
                                            borderLeft: showContent ? undefined : 'none'
                                        }}
                                    >
                                        {items.map((item, itemIndex) => renderItem(item, itemIndex))}
                                        {dropProvided.placeholder}
                                        {items.length === 0 && !dropSnapshot.isDraggingOver && showContent && (
                                            <div className="sidebar-empty-group-text">Pasta vazia</div>
                                        )}
                                    </div>
                                </div>
                            );
                        }}
                    </Droppable>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
