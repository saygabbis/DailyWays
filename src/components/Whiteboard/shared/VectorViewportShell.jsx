import { useWhiteboardViewportZoom } from '../interaction/viewport/useWhiteboardViewportZoom';
import { getSharpSvgLayout, WORLD_DIM_EPSILON } from './vectorViewport.js';

/**
 * Renderiza filhos num espaço lógico (px de ecrã) com nitidez em qualquer zoom do canvas.
 * O layout interno mede width×height×zoom: filhos usam 100% do tamanho e tipografia
 * multiplicada por useSharpRenderZoom() (ver scaleTextCss).
 */
export default function VectorViewportShell({ width, height, className = '', style, innerStyle, children }) {
    const zoom = useWhiteboardViewportZoom();
    const { layoutWidth, layoutHeight, scaleTransform } = getSharpSvgLayout(width, height, zoom);
    const w = Math.max(Number(width) || 0, WORLD_DIM_EPSILON);
    const h = Math.max(Number(height) || 0, WORLD_DIM_EPSILON);

    return (
        <div
            className={className}
            style={{
                position: 'relative',
                width: w,
                height: h,
                overflow: 'visible',
                ...style,
            }}
        >
            <div
                className="whiteboard-vector-sharp"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: layoutWidth,
                    height: layoutHeight,
                    transform: scaleTransform,
                    transformOrigin: 'top left',
                    ...innerStyle,
                }}
            >
                {children}
            </div>
        </div>
    );
}
