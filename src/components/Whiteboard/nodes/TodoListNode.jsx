import React from 'react';
import BaseNode from './BaseNode';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { Check, Square } from 'lucide-react';

export default function TodoListNode({ node, onNodePointerDown }) {
    const items = node.data?.items ?? [{ id: crypto.randomUUID(), text: 'Item', done: false }];
    const { patchNode } = useWhiteboardStore();

    const toggle = (itemId) => {
        const next = items.map((it) =>
            it.id === itemId ? { ...it, done: !it.done } : it
        );
        patchNode(node.id, { data: { ...node.data, items: next } });
    };

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node todo-list-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    padding: 10,
                    overflow: 'auto',
                }}
            >
                {items.map((item) => (
                    <label
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); toggle(item.id); }}
                            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                        >
                            {item.done ? (
                                <Check size={18} style={{ color: 'var(--accent)' }} />
                            ) : (
                                <Square size={18} style={{ color: 'var(--text-tertiary)' }} />
                            )}
                        </button>
                        <span style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                            {item.text}
                        </span>
                    </label>
                ))}
            </div>
        </BaseNode>
    );
}
