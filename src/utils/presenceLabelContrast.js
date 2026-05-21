/** Cor do texto do label de presença (nome ao lado do cursor) para contraste com o fundo. */

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

/** Retorna '#111' para fundos claros e '#fff' para escuros. */
export function presenceLabelTextColor(backgroundColor, fallback = '#fff') {
  const rgb = parseHex(backgroundColor);
  if (!rgb) return fallback;
  return relativeLuminance(rgb) > 0.55 ? '#111111' : '#ffffff';
}
