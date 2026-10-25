import { useMemo } from 'react';
import { useWhiteboardFields } from '../../../stores/whiteboardStore';

function getNodeCenter(node) {
    if (!node) return { x: 0, y: 0 };
    return {
        x: node.x + (node.width || 0) / 2,
        y: node.y + (node.height || 0) / 2,
    };
}

export default function ConnectorLayer() {
    const { connectors, nodes } = useWhiteboardFields('connectors', 'nodes');
    const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

    const paths = useMemo(() => {
        return connectors.map((conn) => {
            const from = nodesById.get(conn.fromNodeId);
            const to = nodesById.get(conn.toNodeId);
            const start = getNodeCenter(from);
            const end = getNodeCenter(to);
            const controlPoints = conn.controlPoints && conn.controlPoints.length >= 2
                ? conn.controlPoints
                : null;
            const pathD = controlPoints
                ? `M ${start.x} ${start.y} Q ${controlPoints[0].x} ${controlPoints[0].y} ${controlPoints[1].x} ${controlPoints[1].y} L ${end.x} ${end.y}`
                : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
            return { id: conn.id, from: conn.fromNodeId, to: conn.toNodeId, pathD, style: conn.style || {} };
        });
    }, [connectors, nodesById]);

    if (paths.length === 0) return null;

    return (
        <svg
            className="connector-layer"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
            }}
        >
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-secondary)" />
                </marker>
            </defs>
            {paths.map((p) => (
                <path
                    key={p.id}
                    data-connector-from={p.from}
                    data-connector-to={p.to}
                    d={p.pathD}
                    fill="none"
                    stroke={p.style.stroke || 'var(--text-secondary)'}
                    strokeWidth={p.style.strokeWidth || 2}
                    markerEnd="url(#arrowhead)"
                />
            ))}
        </svg>
    );
}
