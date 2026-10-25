/**
 * Traço da caneta → caminho vetorial suave (funções puras, coordenadas de mundo).
 * Pontos crus do ponteiro são simplificados (Ramer–Douglas–Peucker) e viram curvas quadráticas
 * pelos pontos médios, o que dá um traço liso e leve de guardar.
 */

function perpendicularDistance(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker iterativo (traço longo não estoura a pilha). */
export function simplifyPoints(points, epsilon) {
    if (!points || points.length < 3) return points ? [...points] : [];
    const keep = new Uint8Array(points.length);
    keep[0] = 1;
    keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const [first, last] = stack.pop();
        let maxDist = 0;
        let index = -1;
        for (let i = first + 1; i < last; i += 1) {
            const d = perpendicularDistance(points[i], points[first], points[last]);
            if (d > maxDist) {
                maxDist = d;
                index = i;
            }
        }
        if (index !== -1 && maxDist > epsilon) {
            keep[index] = 1;
            stack.push([first, index], [index, last]);
        }
    }
    return points.filter((_, i) => keep[i]);
}

const round = (n) => Math.round(n * 100) / 100;

/** Caminho SVG suave por pontos médios (curvas quadráticas). Pontos já relativos à origem. */
export function pointsToSmoothPath(points) {
    if (!points?.length) return '';
    const [p0] = points;
    if (points.length === 1) {
        // ponto solto: um traço mínimo para a ponta redonda desenhar um círculo
        return `M ${round(p0.x)} ${round(p0.y)} L ${round(p0.x + 0.01)} ${round(p0.y)}`;
    }
    if (points.length === 2) {
        return `M ${round(p0.x)} ${round(p0.y)} L ${round(points[1].x)} ${round(points[1].y)}`;
    }
    let d = `M ${round(p0.x)} ${round(p0.y)}`;
    for (let i = 1; i < points.length - 1; i += 1) {
        const p = points[i];
        const next = points[i + 1];
        d += ` Q ${round(p.x)} ${round(p.y)} ${round((p.x + next.x) / 2)} ${round((p.y + next.y) / 2)}`;
    }
    const last = points[points.length - 1];
    d += ` L ${round(last.x)} ${round(last.y)}`;
    return d;
}

/**
 * Monta o nó de desenho a partir do traço.
 * @returns {{ x, y, width, height, data: { paths, vbW, vbH, freehand: true } }}
 */
export function buildFreehandNode(rawPoints, { strokeWidth, epsilon }) {
    const pts = simplifyPoints(rawPoints, epsilon);
    const pad = strokeWidth / 2 + 1e-3;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const x = minX - pad;
    const y = minY - pad;
    const width = maxX - minX + pad * 2;
    const height = maxY - minY + pad * 2;
    const local = pts.map((p) => ({ x: p.x - x, y: p.y - y }));
    return {
        x,
        y,
        width,
        height,
        data: {
            freehand: true,
            vbW: round(width),
            vbH: round(height),
            paths: [{ d: pointsToSmoothPath(local), width: round(strokeWidth) }],
        },
    };
}
