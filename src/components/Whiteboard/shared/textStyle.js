/** Estilos de tipografia partilhados (inspector + nós de texto). */
export const TEXT_STYLE_NODE_TYPES = new Set(['text', 'sticky_note', 'link']);

export const FONT_FAMILY_OPTIONS = [
    { value: '', label: 'Padrão do sistema' },
    { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
    { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Times New Roman", Times, serif', label: 'Times' },
    { value: '"Courier New", Courier, monospace', label: 'Monoespaçada' },
];

export const FONT_WEIGHT_OPTIONS = [
    { value: '400', label: 'Regular' },
    { value: '500', label: 'Médio' },
    { value: '600', label: 'Semibold' },
    { value: '700', label: 'Negrito' },
];

export const TEXT_ALIGN_OPTIONS = [
    { value: 'left', label: 'Esquerda' },
    { value: 'center', label: 'Centro' },
    { value: 'right', label: 'Direita' },
    { value: 'justify', label: 'Justificado' },
];

export function getTextStyleFromNode(node) {
    const s = node?.style ?? {};
    return {
        fontFamily: s.fontFamily ?? '',
        color: s.color ?? (node?.type === 'sticky_note' ? '#111827' : 'var(--text-primary)'),
        fontSize: s.fontSize ?? (node?.type === 'link' ? 14 : 16),
        lineHeight: s.lineHeight ?? 1.35,
        letterSpacing: s.letterSpacing ?? 0,
        fontWeight: s.fontWeight ?? 400,
        textAlign: s.textAlign ?? 'left',
    };
}

export function textStyleToCss(style) {
    const out = {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: typeof style.letterSpacing === 'number'
            ? `${style.letterSpacing}px`
            : style.letterSpacing,
        fontWeight: style.fontWeight,
        textAlign: style.textAlign,
        color: style.color,
    };
    if (style.fontFamily) out.fontFamily = style.fontFamily;
    return out;
}

/**
 * Tipografia para dentro do VectorViewportShell: lá dentro 1 px = 1 px de tela (layout × zoom),
 * então tamanhos em unidades de mundo são multiplicados pelo zoom de render.
 * Sem isso o texto crescia ao afastar (vazava da nota) e encolhia ao aproximar.
 */
export function scaleTextCss(css, k) {
    const out = { ...css };
    if (typeof out.fontSize === 'number') out.fontSize = out.fontSize * k;
    const ls = parseFloat(out.letterSpacing);
    if (Number.isFinite(ls)) out.letterSpacing = `${ls * k}px`;
    return out;
}
