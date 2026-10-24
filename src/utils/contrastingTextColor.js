/** Cor de texto com contraste legível sobre um fundo (hex). */

function parseHex(color) {
    if (!color || typeof color !== 'string') return null;
    const s = color.trim();
    const short = /^#([0-9a-f]{3})$/i.exec(s);
    if (short) {
        const [r, g, b] = short[1].split('');
        return {
            r: parseInt(r + r, 16),
            g: parseInt(g + g, 16),
            b: parseInt(b + b, 16),
        };
    }
    const long = /^#([0-9a-f]{6})$/i.exec(s);
    if (long) {
        const n = parseInt(long[1], 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return null;
}

function relativeLuminance({ r, g, b }) {
    const lin = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Retorna cor escura ou clara para legibilidade sobre o fundo. */
export function contrastingTextColor(backgroundColor, fallback = '#1f2937') {
    const rgb = parseHex(backgroundColor);
    if (!rgb) return fallback;
    return relativeLuminance(rgb) > 0.55 ? '#111827' : '#f9fafb';
}

const contrastRatio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const INK = '#111118';

/**
 * Branco ou quase-preto: o que tiver mais contraste (WCAG) com TODAS as cores dadas (as pontas de
 * um gradiente, por exemplo). Usado para o texto sobre a cor de destaque.
 */
export function readableTextOn(...colors) {
    const lums = colors.map(parseHex).filter(Boolean).map(relativeLuminance);
    if (!lums.length) return '#ffffff';
    const inkLum = relativeLuminance(parseHex(INK));
    const white = Math.min(...lums.map((l) => contrastRatio(l, 1)));
    const ink = Math.min(...lums.map((l) => contrastRatio(l, inkLum)));
    return white >= ink ? '#ffffff' : INK;
}
