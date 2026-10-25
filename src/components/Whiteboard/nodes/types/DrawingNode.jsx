import BaseNode from './BaseNode';
import VectorViewportShell from '../../shared/VectorViewportShell.jsx';
import { useWhiteboardViewportZoom } from '../../interaction/viewport/useWhiteboardViewportZoom';
import { strokeWidthInWorld, WORLD_DIM_EPSILON } from '../../shared/vectorViewport.js';
import { screenPxToWorld } from '../../interaction/viewport/viewportLimits.js';

/** Traço da caneta: caminho vetorial que estica junto com o nó (viewBox do tamanho original). */
function FreehandDrawing({ node, onNodePointerDown, onNodeContextMenu }) {
    const paths = node.data?.paths ?? [];
    const stroke = node.style?.stroke ?? '#8b5cf6';
    const w = Math.max(node.width ?? 0, WORLD_DIM_EPSILON);
    const h = Math.max(node.height ?? 0, WORLD_DIM_EPSILON);
    const vbW = node.data?.vbW || w;
    const vbH = node.data?.vbH || h;
    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <svg
                className="whiteboard-node drawing-node drawing-node--freehand"
                width={w}
                height={h}
                viewBox={`0 0 ${vbW} ${vbH}`}
                preserveAspectRatio="none"
                style={{ display: 'block', overflow: 'visible' }}
            >
                {paths.map((path, i) => (
                    <path
                        key={i}
                        d={path.d ?? ''}
                        fill="none"
                        stroke={path.stroke ?? stroke}
                        strokeWidth={path.width ?? 3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        shapeRendering="geometricPrecision"
                    />
                ))}
            </svg>
        </BaseNode>
    );
}

export default function DrawingNode(props) {
    if (props.node?.data?.freehand) return <FreehandDrawing {...props} />;
    return <DrawingBox {...props} />;
}

function DrawingBox({ node, onNodePointerDown, onNodeContextMenu }) {
    const paths = node.data?.paths ?? [];
    const stroke = node.style?.stroke ?? '#000';
    const zoom = useWhiteboardViewportZoom();
    const w = Math.max(node.width ?? 0, WORLD_DIM_EPSILON);
    const h = Math.max(node.height ?? 0, WORLD_DIM_EPSILON);
    const borderWorld = screenPxToWorld(zoom, 1);
    const radiusWorld = screenPxToWorld(zoom, 8);

    return (
        <BaseNode node={node} onNodePointerDown={onNodePointerDown} onNodeContextMenu={onNodeContextMenu}>
            <VectorViewportShell
                width={w}
                height={h}
                className="whiteboard-node drawing-node"
                style={{
                    border: `${borderWorld}px solid var(--border-color)`,
                    borderRadius: radiusWorld,
                    backgroundColor: 'var(--bg-elevated)',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                }}
            >
                <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
                    {paths.length > 0 ? (
                        paths.map((path, i) => {
                            const screenStroke = path.strokeWidth ?? 2;
                            return (
                                <path
                                    key={i}
                                    d={path.d ?? ''}
                                    fill="none"
                                    stroke={path.stroke ?? stroke}
                                    strokeWidth={strokeWidthInWorld(zoom, screenStroke)}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    shapeRendering="geometricPrecision"
                                />
                            );
                        })
                    ) : (
                        <text
                            x={w / 2}
                            y={h / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--text-tertiary)"
                            fontSize={strokeWidthInWorld(zoom, 12)}
                        >
                            Desenho
                        </text>
                    )}
                </svg>
            </VectorViewportShell>
        </BaseNode>
    );
}
