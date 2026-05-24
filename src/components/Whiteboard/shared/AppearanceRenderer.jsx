import React, { useId, memo } from 'react';
import {
    getAppearanceFromNode,
    getCornerRadii,
    strokeDashArray,
    colorWithOpacity,
    polygonPointsInRect,
    strokeViewportPad,
    sameNodeVisual,
} from './appearanceStyle.js';

function fillDefId(baseId, suffix) {
    return `${baseId}-fill-${suffix}`;
}

function renderFillDefs(appearance, width, height, baseId) {
    const fill = appearance.fill;
    if (!fill?.visible) return null;
    if (fill.type === 'image' && fill.imageUrl) {
        const id = fillDefId(baseId, 'img');
        return (
            <defs>
                <pattern id={id} patternUnits="objectBoundingBox" width="1" height="1">
                    <image
                        href={fill.imageUrl}
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

function fillPaint(appearance, baseId) {
    const fill = appearance.fill;
    if (!fill?.visible) return 'none';
    if (fill.type === 'image' && fill.imageUrl) {
        return `url(#${fillDefId(baseId, 'img')})`;
    }
    return colorWithOpacity(fill.color ?? '#ffffff', fill.opacity);
}

function strokePaint(appearance) {
    const stroke = appearance.stroke;
    if (!stroke?.visible) return { stroke: 'none', strokeWidth: 0 };
    return {
        stroke: colorWithOpacity(stroke.color ?? '#000', stroke.opacity),
        strokeWidth: stroke.width ?? 1,
        strokeDasharray: strokeDashArray(stroke.dash, stroke.width),
    };
}

function insetForAlign(align, strokeWidth, w, h) {
    const sw = strokeWidth ?? 0;
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
 * Renderiza aparência vetorial (forma/frame body).
 * @param {{ node, width, height, shapeKind?: 'rectangle'|'ellipse'|'polygon', polygonSides?: number, className?: string }}
 */
export default memo(function AppearanceRenderer({
    node,
    width,
    height,
    shapeKind = 'rectangle',
    polygonSides = 6,
    className = '',
}) {
    const baseId = useId().replace(/:/g, '');
    const appearance = getAppearanceFromNode(node);
    const opacity = (appearance.opacity ?? 100) / 100;
    const radii = getCornerRadii(appearance);
    const stroke = appearance.stroke ?? {};
    const { x, y, w, h } = insetForAlign(stroke.align, stroke.width, width, height);
    const strokeProps = strokePaint(appearance);
    const fill = fillPaint(appearance, baseId);
    const pad = strokeViewportPad(stroke);
    const viewBox = `${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`;

    const clipId = `${baseId}-clip`;

    let shapeEl;
    if (shapeKind === 'ellipse') {
        shapeEl = (
            <ellipse
                cx={x + w / 2}
                cy={y + h / 2}
                rx={w / 2}
                ry={h / 2}
                fill={fill}
                {...strokeProps}
            />
        );
    } else if (shapeKind === 'polygon') {
        const pts = polygonPointsInRect(polygonSides, x, y, w, h);
        shapeEl = (
            <polygon
                points={pts}
                fill={fill}
                {...strokeProps}
            />
        );
    } else {
        const pathD = roundedRectPath(x, y, w, h, radii);
        shapeEl = (
            <path
                d={pathD}
                fill={fill}
                {...strokeProps}
            />
        );
    }

    const useClip = stroke.align === 'inside' && stroke.visible;

    const clipShape =
        shapeKind === 'ellipse' ? (
            <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
        ) : shapeKind === 'polygon' ? (
            <polygon points={polygonPointsInRect(polygonSides, x, y, w, h)} />
        ) : (
            <path d={roundedRectPath(x, y, w, h, radii)} />
        );

    return (
        <svg
            className={`whiteboard-appearance-renderer ${className}`.trim()}
            width={width}
            height={height}
            viewBox={viewBox}
            overflow="visible"
            style={{ display: 'block', opacity, overflow: 'visible' }}
            aria-hidden
        >
            {renderFillDefs(appearance, width, height, baseId)}
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
