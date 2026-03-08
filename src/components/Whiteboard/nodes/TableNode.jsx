import React from 'react';
import BaseNode from './BaseNode';

export default function TableNode({ node, onNodePointerDown }) {
    const rows = node.data?.rows ?? [];
    const cols = node.data?.cols ?? [];

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown}>
            <div
                className="whiteboard-node table-node"
                style={{
                    width: node.width,
                    height: node.height,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-elevated)',
                    overflow: 'auto',
                    padding: 4,
                }}
            >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    {(rows.length > 0 || cols.length > 0) ? (
                        <>
                            {cols.length > 0 && (
                                <thead>
                                    <tr>
                                        {cols.map((c, i) => (
                                            <th key={i} style={{ border: '1px solid var(--border-color)', padding: 4, textAlign: 'left' }}>{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                            )}
                            <tbody>
                                {rows.map((row, ri) => (
                                    <tr key={ri}>
                                        {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                                            <td key={ci} style={{ border: '1px solid var(--border-color)', padding: 4 }}>{String(cell)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </>
                    ) : (
                        <tbody><tr><td style={{ color: 'var(--text-tertiary)' }}>Tabela</td></tr></tbody>
                    )}
                </table>
            </div>
        </BaseNode>
    );
}
