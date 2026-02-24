import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Folder, FolderOpen, MoreHorizontal, Edit3, Trash2, Check } from 'lucide-react';

export default function SidebarGroup({ group, index, items, activeView, activeBoard, onContextMenu, onToggleSelection, selectedItems = [], isDraggingBulk = false, onRename, onClickItem, renderItem }) {
    // Folders should always be toggleable. We just consider it "visually closed" if it's explicitly collapsed.
    const effectiveIsExpanded = Boolean(group.isExpanded);

    return (
        <Draggable draggableId={group.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`sidebar-group ${snapshot.isDragging ? 'dragging' : ''}`}
                >
                    <Droppable droppableId={`group-${group.id}`} type={group.type}>
                        {(dropProvided, dropSnapshot) => {
                            const showContent = effectiveIsExpanded || dropSnapshot.isDraggingOver;
                            return (
                                <div
                                    ref={dropProvided.innerRef}
                                    {...dropProvided.droppableProps}
                                    className={`sidebar-group-droppable ${dropSnapshot.isDraggingOver ? 'group-drag-over' : ''}`}
                                >
                                    {/* Folder Header */}
                                    <div
                                        className="sidebar-group-header sidebar-item group-header-item"
                                        onClick={() => onClickItem(group)}
                                        onContextMenu={(e) => onContextMenu(e, group)}
                                        onDoubleClick={(e) => { e.stopPropagation(); onRename && onRename(group); }}
                                    >
                                        <div
                                            className={`sidebar-board-checkbox ${selectedItems?.includes(group.id) ? 'selected' : ''}`}
                                            title="Selecionar"
                                            onClick={(e) => { e.stopPropagation(); onToggleSelection(e); }}
                                        >
                                            {selectedItems?.includes(group.id) && <Check size={10} strokeWidth={4} />}
                                        </div>

                                        <span className="sidebar-group-icon" {...provided.dragHandleProps} title="Arrastar Pasta" style={{ cursor: 'grab' }}>
                                            {effectiveIsExpanded ? <FolderOpen size={16} /> : (items.length > 0 ? <Folder size={16} fill="currentColor" /> : <Folder size={16} />)}
                                        </span>

                                        <span className="truncate" style={{ fontWeight: 600 }}>{group.title}</span>

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
                                            height: showContent ? 'auto' : '0px',
                                            overflow: showContent ? 'visible' : 'hidden',
                                            opacity: showContent ? 1 : 0,
                                            pointerEvents: showContent ? 'auto' : 'none',
                                            minHeight: showContent ? '26px' : '0px',
                                            paddingTop: showContent ? undefined : 0,
                                            paddingBottom: showContent ? undefined : 0,
                                            marginTop: showContent ? undefined : 0,
                                            marginBottom: showContent ? undefined : 0,
                                            borderLeft: showContent ? undefined : 'none'
                                        }}
                                    >
                                        {items.map((item, itemIndex) => renderItem(item, itemIndex))}
                                        {dropProvided.placeholder}
                                        {items.length === 0 && !dropSnapshot.isDraggingOver && (
                                            <div className="sidebar-empty-group-text">Pasta vazia</div>
                                        )}
                                    </div>
                                </div>
                            );
                        }}
                    </Droppable>
                </div>
            )}
        </Draggable>
    );
}
