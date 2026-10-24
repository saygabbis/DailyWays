import { useId, memo } from 'react';
import { useSpaceAssetUrl } from '../../../hooks/useSpaceAssetUrl';
import { useWhiteboardViewportZoom } from '../interaction/viewport/useWhiteboardViewportZoom';
import {
    getAppearanceFromNode,
    getCornerRadii,
    strokeDashArray,
    colorWithOpacity,
    polygonPointsInRect,
    strokeViewportPad,
    sameNodeVisual,
} from './appearanceStyle.js';
import {
    effectiveStrokeScreenPx,
    getSharpSvgLayout,
    strokeWidthInViewBoxUnits,
    strokeWidthInWorldForNode,
    WORLD_DIM_EPSILON,
} from './vectorViewport.js';

function fillDefId(baseId, suffix) {
    return `${baseId}-fill-${suffix}`;
}

function renderFillDefs(appearance, width, height, baseId, imageSrc) {
    const fill = appearance.fill;
    if (!fill?.visible) return null;
    if (fill.type === 'image' && imageSrc) {
        const id = fillDefId(baseId, 'img');
        return (
            <defs>
                <pattern id={id} patternUnits="objectBoundingBox" width="1" height="1">
                    <image
                        href={imageSrc}
                        width={width}
                        height={height}
                        preserveAspectRatio={fill.imageScale === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'}
                    />
                </pattern>
            </defs>
        );
    }
    return null;
}

function fillPaint(appearance, baseId, imageSrc) {
    const fill = appearance.fill;
    if (!fill?.visible) return 'none';
    if (fill.type === 'image' && imageSrc) {
        return `url(#${fillDefId(baseId, 'img')})`;
    }
    return colorWithOpacity(fill.color ?? '#ffffff', fill.opacity);
}

function strokePaint(appearance, zoom, viewW, viewH, viewBoxWidth) {
    const stroke = appearance.stroke;
    if (!stroke?.visible) return { stroke: 'none', strokeWidth: 0 };
    const screenW = effectiveStrokeScreenPx(stroke) || 1;
    const worldW = strokeWidthInViewBoxUnits(zoom, screenW, viewBoxWidth);
    const dashUnit = strokeWidthInViewBoxUnits(zoom, screenW, viewBoxWidth);
    return {
        stroke: colorWithOpacity(stroke.color ?? '#000', stroke.opacity),
        strokeWidth: worldW,
        strokeDasharray: strokeDashArray(stroke.dash, dashUnit),
    };
}

function insetForAlign(align, stroke, w, h, zoom) {
    const sw = strokeWidthInWorldForNode(zoom, stroke ?? {});
    if (align === 'inside') return { x: sw / 2, y: sw / 2, w: w - sw, h: h - sw };
    if (align === 'outside') return { x: -sw / 2, y: -sw / 2, w: w + sw, h: h + sw };
    return { x: 0, y: 0, w, h };
}

function cornerPathRadii(radii, w, h) {
    const maxR = Math.min(w, h) / 2;
    const tl = Math.min(radii.tl, maxR);
    const tr = Math.min(radii.tr, maxR);
    const br = Math.min(radii.br, maxR);
    const bl = Math.min(radii.bl, maxR);
    return { tl, tr, br, bl };
}

function roundedRectPath(x, y, w, h, radii) {
    const { tl, tr, br, bl } = cornerPathRadii(radii, w, h);
    return `M ${x + tl} ${y} L ${x + w - tr} ${y} Q ${x + w} ${y} ${x + w} ${y + tr} L ${x + w} ${y + h - br} Q ${x + w} ${y + h} ${x + w - br} ${y + h} L ${x + bl} ${y + h} Q ${x} ${y + h} ${x} ${y + h - bl} L ${x} ${y + tl} Q ${x} ${y} ${x + tl} ${y} Z`;
}

/**
 * Renderiza aparência vetorial (forma/frame body) com nitidez em qualquer zoom.
 */
export default memo(function AppearanceRenderer({
    node,
    width,
    height,
    shapeKind = 'rectangle',
    polygonSides = 6,
    className = '',
}) {
    const zoom = useWhiteboardViewportZoom();
    const baseId = useId().replace(/:/g, '');
    const w = Math.max(Number(width) || 0, WORLD_DIM_EPSILON);
    const h = Math.max(Number(height) || 0, WORLD_DIM_EPSILON);
    const appearance = getAppearanceFromNode(node);
    const appearanceFill = appearance.fill;
    const imageSrc = useSpaceAssetUrl(
        appearanceFill?.type === 'image'
            ? { storagePath: appearanceFill.imageStoragePath, url: appearanceFill.imageUrl }
            : null,
    );
    const opacity = (appearance.opacity ?? 100) / 100;
    const radii = getCornerRadii(appearance);
    const stroke = appearance.stroke ?? {};
    const { x, y, w: iw, h: ih } = insetForAlign(stroke.align, stroke, w, h, zoom);
    const pad = strokeViewportPad(stroke, zoom);
    const viewBoxWidth = w + pad * 2;
    const strokeProps = strokePaint(appearance, zoom, w, h, viewBoxWidth);
    const fill = fillPaint(appearance, baseId, imageSrc);
    const viewBox = `${-pad} ${-pad} ${viewBoxWidth} ${h + pad * 2}`;
    const { layoutWidth, layoutHeight, scaleTransform } = getSharpSvgLayout(w, h, zoom);

    const clipId = `${baseId}-clip`;

    let shapeEl;
    if (shapeKind === 'ellipse') {
        shapeEl = (
            <ellipse
                cx={x + iw / 2}
                cy={y + ih / 2}
                rx={iw / 2}
                ry={ih / 2}
                fill={fill}
                shapeRendering="geometricPrecision"
                {...strokeProps}
            />
        );
    } else if (shapeKind === 'polygon') {
        const pts = polygonPointsInRect(polygonSides, x, y, iw, ih);
        shapeEl = (
            <polygon
                points={pts}
                fill={fill}
                shapeRendering="geometricPrecision"
                {...strokeProps}
            />
        );
    } else {
        const pathD = roundedRectPath(x, y, iw, ih, radii);
        shapeEl = (
            <path
                d={pathD}
                fill={fill}
                shapeRendering="geometricPrecision"
                {...strokeProps}
            />
        );
    }

    const useClip = stroke.align === 'inside' && stroke.visible;

    const clipShape =
        shapeKind === 'ellipse' ? (
            <ellipse cx={x + iw / 2} cy={y + ih / 2} rx={iw / 2} ry={ih / 2} />
        ) : shapeKind === 'polygon' ? (
            <polygon points={polygonPointsInRect(polygonSides, x, y, iw, ih)} />
        ) : (
            <path d={roundedRectPath(x, y, iw, ih, radii)} />
        );

    return (
        <svg
            className={`whiteboard-appearance-renderer ${className}`.trim()}
            width={layoutWidth}
            height={layoutHeight}
            viewBox={viewBox}
            preserveAspectRatio="none"
            overflow="visible"
            style={{
                display: 'block',
                opacity,
                overflow: 'visible',
                transform: scaleTransform,
                transformOrigin: 'top left',
            }}
            aria-hidden
        >
            {renderFillDefs(appearance, w, h, baseId, imageSrc)}
            {useClip && (
                <defs>
                    <clipPath id={clipId}>{clipShape}</clipPath>
                </defs>
            )}
            <g clipPath={useClip ? `url(#${clipId})` : undefined}>
                {shapeEl}
            </g>
        </svg>
    );
}, (prev, next) =>
    prev.width === next.width &&
    prev.height === next.height &&
    prev.shapeKind === next.shapeKind &&
    prev.polygonSides === next.polygonSides &&
    prev.className === next.className &&
    sameNodeVisual(prev.node, next.node));
