const H_VALUES = new Set(['left', 'right', 'left-right', 'center', 'scale']);
const V_VALUES = new Set(['top', 'bottom', 'top-bottom', 'center', 'scale']);

export const FRAME_CONSTRAINT_DEFAULT = Object.freeze({
    horizontal: 'left',
    vertical: 'top',
});

export function normalizeFrameConstraints(raw) {
    const horizontal = H_VALUES.has(raw?.horizontal) ? raw.horizontal : FRAME_CONSTRAINT_DEFAULT.horizontal;
    const vertical = V_VALUES.has(raw?.vertical) ? raw.vertical : FRAME_CONSTRAINT_DEFAULT.vertical;
    return { horizontal, vertical };
}

export function getNodeFrameConstraints(node) {
    return normalizeFrameConstraints(node?.data?.constraints);
}

function clampSize(value) {
    return Math.max(1, Number.isFinite(value) ? value : 1);
}

function applyHorizontal(oldX, oldW, newW, child) {
    const x = child.x ?? 0;
    const w = clampSize(child.width ?? 0);
    const mode = child.constraints.horizontal;
    const ratio = oldW > 0 ? newW / oldW : 1;
    const right = oldW - (x + w);
    const centerOffset = (x + w / 2) - oldW / 2;

    if (mode === 'right') return { x: newW - right - w, width: w };
    if (mode === 'left-right') {
        const width = clampSize(newW - x - right);
        return { x, width };
    }
    if (mode === 'center') return { x: (newW / 2) + centerOffset - (w / 2), width: w };
    if (mode === 'scale') return { x: x * ratio, width: clampSize(w * ratio) };
    return { x, width: w };
}

function applyVertical(oldY, oldH, newH, child) {
    const y = child.y ?? 0;
    const h = clampSize(child.height ?? 0);
    const mode = child.constraints.vertical;
    const ratio = oldH > 0 ? newH / oldH : 1;
    const bottom = oldH - (y + h);
    const centerOffset = (y + h / 2) - oldH / 2;

    if (mode === 'bottom') return { y: newH - bottom - h, height: h };
    if (mode === 'top-bottom') {
        const height = clampSize(newH - y - bottom);
        return { y, height };
    }
    if (mode === 'center') return { y: (newH / 2) + centerOffset - (h / 2), height: h };
    if (mode === 'scale') return { y: y * ratio, height: clampSize(h * ratio) };
    return { y, height: h };
}

export function applyFrameResizeToChildren(children, frameBefore, frameAfter) {
    const oldW = clampSize(frameBefore.width ?? 0);
    const oldH = clampSize(frameBefore.height ?? 0);
    const newW = clampSize(frameAfter.width ?? oldW);
    const newH = clampSize(frameAfter.height ?? oldH);
    if (!children?.length) return [];

    return children.map((node) => {
        const constraints = getNodeFrameConstraints(node);
        const horizontal = applyHorizontal(frameBefore.x ?? 0, oldW, newW, { ...node, constraints });
        const vertical = applyVertical(frameBefore.y ?? 0, oldH, newH, { ...node, constraints });
        return {
            id: node.id,
            patch: {
                x: horizontal.x,
                y: vertical.y,
                width: horizontal.width,
                height: vertical.height,
                data: {
                    ...(node.data || {}),
                    constraints,
                },
            },
        };
    });
}

