export const APPEARANCE_NODE_TYPES = new Set(['shape', 'frame']);

export const STROKE_ALIGN_OPTIONS = ['inside', 'center', 'outside'];
export const STROKE_DASH_OPTIONS = ['solid', 'dashed', 'dotted'];
export const FILL_TYPE_OPTIONS = ['color', 'image'];

const DEFAULT_APPEARANCE = {
    opacity: 100,
    cornersLinked: true,
    cornerRadius: 0,
    cornerRadiusIndividual: null,
    fill: {
        visible: true,
        type: 'color',
        color: '#ffffff',
        opacity: 100,
        imageUrl: null,
        imageScale: 'fill',
    },
    stroke: {
        visible: true,
        color: '#000000',
        opacity: 100,
        width: 1,
        align: 'center',
        dash: 'solid',
    },
};

const FRAME_DEFAULTS = {
    opacity: 100,
    cornerRadius: 8,
    fill: {
        visible: true,
        type: 'color',
        color: 'var(--bg-elevated)',
        opacity: 100,
        imageUrl: null,
        imageScale: 'fill',
    },
    stroke: {
        visible: true,
        color: 'var(--border-color)',
        opacity: 100,
        width: 2,
        align: 'center',
        dash: 'dashed',
    },
};

const SHAPE_DEFAULTS = {
    fill: {
        visible: true,
        type: 'color',
        color: 'var(--bg-elevated)',
        opacity: 100,
    },
    stroke: {
        visible: true,
        color: 'var(--border-color)',
        opacity: 100,
        width: 2,
        align: 'center',
        dash: 'solid',
    },
};

function deepMergeAppearance(base, patch) {
    if (!patch) return base;
    return {
        ...base,
        ...patch,
        fill: patch.fill ? { ...base.fill, ...patch.fill } : base.fill,
        stroke: patch.stroke ? { ...base.stroke, ...patch.stroke } : base.stroke,
        cornerRadiusIndividual: patch.cornerRadiusIndividual !== undefined
            ? patch.cornerRadiusIndividual
            : base.cornerRadiusIndividual,
    };
}

export function getDefaultAppearanceStyle(nodeType) {
    const typeDefaults = nodeType === 'frame' ? FRAME_DEFAULTS : SHAPE_DEFAULTS;
    return deepMergeAppearance(DEFAULT_APPEARANCE, typeDefaults);
}

function migrateLegacyStyle(style = {}) {
    const appearance = { ...DEFAULT_APPEARANCE };
    if (style.fill != null) {
        appearance.fill = {
            ...appearance.fill,
            type: 'color',
            color: style.fill,
            visible: true,
        };
    }
    if (style.stroke != null) {
        appearance.stroke = {
            ...appearance.stroke,
            color: style.stroke,
            visible: true,
            width: style.strokeWidth ?? appearance.stroke.width,
        };
    }
    if (style.backgroundColor != null) {
        appearance.fill = {
            ...appearance.fill,
            type: 'color',
            color: style.backgroundColor,
            visible: true,
        };
    }
    return appearance;
}

export function getAppearanceFromNode(node) {
    const typeDefaults = getDefaultAppearanceStyle(node?.type);
    const raw = node?.style?.appearance;
    if (raw) {
        return deepMergeAppearance(typeDefaults, raw);
    }
    const legacy = migrateLegacyStyle(node?.style);
    return deepMergeAppearance(typeDefaults, legacy);
}

export function mergeAppearance(current, partial) {
    return deepMergeAppearance(current ?? DEFAULT_APPEARANCE, partial);
}

export function appearanceToNodeStylePatch(node, appearancePartial) {
    const current = getAppearanceFromNode(node);
    const next = mergeAppearance(current, appearancePartial);
    return {
        style: {
            ...(node.style || {}),
            appearance: next,
        },
    };
}

export function getCornerRadii(appearance) {
    if (!appearance.cornersLinked && appearance.cornerRadiusIndividual) {
        const { tl = 0, tr = 0, br = 0, bl = 0 } = appearance.cornerRadiusIndividual;
        return { tl, tr, br, bl };
    }
    const r = appearance.cornerRadius ?? 0;
    return { tl: r, tr: r, br: r, bl: r };
}

export function strokeDashArray(dash, width = 1) {
    switch (dash) {
        case 'dashed':
            return `${Math.max(4, width * 3)},${Math.max(2, width * 2)}`;
        case 'dotted':
            return `${Math.max(1, width)},${Math.max(2, width * 1.5)}`;
        default:
            return undefined;
    }
}

export function colorWithOpacity(color, opacityPct) {
    const pct = Math.max(0, Math.min(100, opacityPct ?? 100));
    if (pct >= 100) return color;
    if (typeof color !== 'string') return color;
    if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
        const hex = color.length === 4
            ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
            : color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${pct / 100})`;
    }
    return color;
}

/** Pontos de polígono regular inscrito no retângulo w×h (origem 0,0). */
export function polygonPoints(sides, width, height) {
    return polygonPointsInRect(sides, 0, 0, width, height);
}

/** Pontos de polígono regular inscrito em retângulo arbitrário. */
export function polygonPointsInRect(sides, x, y, w, h) {
    const n = Math.max(3, Math.min(24, sides ?? 6));
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const pts = [];
    for (let i = 0; i < n; i += 1) {
        const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
        pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
    }
    return pts.join(' ');
}

/** Padding extra do viewBox SVG para a borda não ser cortada (center/outside). */
export function strokeViewportPad(stroke) {
    if (!stroke?.visible) return 0;
    const sw = Number(stroke.width) || 0;
    if (sw <= 0) return 0;
    if (stroke.align === 'outside') return sw;
    if (stroke.align === 'inside') return 0;
    return sw / 2;
}

/** Compara props visuais do nó (ignora x/y — posição vem do wrapper). */
export function sameNodeVisual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.width === b.width &&
        a.height === b.height &&
        a.rotation === b.rotation &&
        a.scale === b.scale &&
        a.style === b.style &&
        a.data?.shape === b.data?.shape &&
        a.data?.polygonSides === b.data?.polygonSides &&
        a.data?.title === b.data?.title
    );
}
