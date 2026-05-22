/**
 * Calcula x, y, width, height ao redimensionar um nó (cantos e lados).
 * @param {{ x: number, y: number, width: number, height: number }} origin — snapshot no início do drag
 * @param {'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w'} handle
 * @param {{ x: number, y: number }} world — cursor em coordenadas mundo
 * @param {{ shiftKey?: boolean, altKey?: boolean, min?: number }} modifiers
 */
export function computeResizeBounds(origin, handle, world, modifiers = {}) {
    const min = modifiers.min ?? 0;
    const shiftKey = !!modifiers.shiftKey;
    const altKey = !!modifiers.altKey;

    const w0 = Math.max(min, origin.width || min);
    const h0 = Math.max(min, origin.height || min);
    const right = origin.x + w0;
    const bottom = origin.y + h0;
    const cx = origin.x + w0 / 2;
    const cy = origin.y + h0 / 2;
    const aspect = w0 / h0;

    let x = origin.x;
    let y = origin.y;
    let w = w0;
    let h = h0;

    const isEdge = handle === 'n' || handle === 's' || handle === 'e' || handle === 'w';

    if (altKey) {
        let halfW = w0 / 2;
        let halfH = h0 / 2;
        switch (handle) {
            case 'se':
                halfW = Math.max(min / 2, world.x - cx);
                halfH = Math.max(min / 2, world.y - cy);
                break;
            case 'sw':
                halfW = Math.max(min / 2, cx - world.x);
                halfH = Math.max(min / 2, world.y - cy);
                break;
            case 'ne':
                halfW = Math.max(min / 2, world.x - cx);
                halfH = Math.max(min / 2, cy - world.y);
                break;
            case 'nw':
                halfW = Math.max(min / 2, cx - world.x);
                halfH = Math.max(min / 2, cy - world.y);
                break;
            case 'e':
                halfW = Math.max(min / 2, world.x - cx);
                break;
            case 'w':
                halfW = Math.max(min / 2, cx - world.x);
                break;
            case 's':
                halfH = Math.max(min / 2, world.y - cy);
                break;
            case 'n':
                halfH = Math.max(min / 2, cy - world.y);
                break;
            default:
                break;
        }
        if (handle === 'e' || handle === 'w' || handle === 'se' || handle === 'sw' || handle === 'ne' || handle === 'nw') {
            w = Math.max(min, halfW * 2);
        }
        if (handle === 'n' || handle === 's' || handle === 'se' || handle === 'sw' || handle === 'ne' || handle === 'nw') {
            h = Math.max(min, halfH * 2);
        }
        x = cx - w / 2;
        y = cy - h / 2;
    } else {
        switch (handle) {
            case 'se':
                w = Math.max(min, world.x - origin.x);
                h = Math.max(min, world.y - origin.y);
                break;
            case 'sw':
                x = world.x;
                y = origin.y;
                w = Math.max(min, right - world.x);
                h = Math.max(min, world.y - origin.y);
                break;
            case 'ne':
                x = origin.x;
                y = world.y;
                w = Math.max(min, world.x - origin.x);
                h = Math.max(min, bottom - world.y);
                break;
            case 'nw':
                x = world.x;
                y = world.y;
                w = Math.max(min, right - world.x);
                h = Math.max(min, bottom - world.y);
                break;
            case 'e':
                w = Math.max(min, world.x - origin.x);
                break;
            case 'w':
                x = world.x;
                w = Math.max(min, right - world.x);
                break;
            case 's':
                h = Math.max(min, world.y - origin.y);
                break;
            case 'n':
                y = world.y;
                h = Math.max(min, bottom - world.y);
                break;
            default:
                break;
        }
    }

    if (shiftKey && aspect > 0 && Number.isFinite(aspect)) {
        if (isEdge) {
            if (handle === 'e' || handle === 'w') {
                h = w / aspect;
                if (altKey) {
                    x = cx - w / 2;
                    y = cy - h / 2;
                } else {
                    y = bottom - h;
                }
            } else {
                w = h * aspect;
                if (altKey) {
                    x = cx - w / 2;
                    y = cy - h / 2;
                } else {
                    x = right - w;
                }
            }
        } else {
            const dw = Math.abs(w - w0);
            const dh = Math.abs(h - h0);
            if (dw >= dh) {
                h = w / aspect;
            } else {
                w = h * aspect;
            }
            if (altKey) {
                x = cx - w / 2;
                y = cy - h / 2;
            } else {
                switch (handle) {
                    case 'se':
                        x = origin.x;
                        y = origin.y;
                        break;
                    case 'sw':
                        x = right - w;
                        y = origin.y;
                        break;
                    case 'ne':
                        x = origin.x;
                        y = bottom - h;
                        break;
                    case 'nw':
                        x = right - w;
                        y = bottom - h;
                        break;
                    default:
                        break;
                }
            }
        }
    }

    w = Math.max(min, w);
    h = Math.max(min, h);

    return { x, y, width: w, height: h };
}
