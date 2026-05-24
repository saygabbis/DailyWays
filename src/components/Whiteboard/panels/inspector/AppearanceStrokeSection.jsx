import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import InspectorSection from './InspectorSection.jsx';
import { useInspectorStylePatch } from './useInspectorStylePatch.js';

const ALIGN_OPTIONS = [
    { id: 'inside', label: 'Dentro' },
    { id: 'center', label: 'Centro' },
    { id: 'outside', label: 'Fora' },
];

const DASH_OPTIONS = [
    { id: 'solid', label: 'Sólida' },
    { id: 'dashed', label: 'Tracejada' },
    { id: 'dotted', label: 'Pontilhada' },
];

export default function AppearanceStrokeSection({ node }) {
    const { appearance, patchAppearance } = useInspectorStylePatch(node);
    if (!appearance) return null;

    const stroke = appearance.stroke ?? {};
    const hexColor = stroke.color?.startsWith('#') ? stroke.color : '#000000';

    const patchStroke = (partial) => patchAppearance({ stroke: { ...stroke, ...partial } });

    return (
        <InspectorSection
            title="Borda"
            actions={
                <button
                    type="button"
                    className="inspector-icon-btn"
                    title={stroke.visible !== false ? 'Ocultar' : 'Mostrar'}
                    onClick={() => patchStroke({ visible: stroke.visible === false })}
                >
                    {stroke.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            }
        >
            <div className="inspector-block-row">
                <input
                    type="color"
                    className="space-inspector-color-input inspector-swatch"
                    value={hexColor}
                    onChange={(e) => patchStroke({ color: e.target.value })}
                />
                <input
                    type="text"
                    className="inspector-hex-input"
                    value={hexColor.replace('#', '').toUpperCase()}
                    onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
                        if (raw.length === 6) patchStroke({ color: `#${raw}` });
                    }}
                />
                <input
                    type="number"
                    min={0}
                    max={100}
                    className="inspector-opacity-input"
                    value={stroke.opacity ?? 100}
                    onChange={(e) => patchStroke({ opacity: Number(e.target.value) })}
                />
                <span className="inspector-value-label">%</span>
            </div>

            <label className="space-inspector-field space-inspector-field--full">
                <span>Espessura</span>
                <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={stroke.width ?? 1}
                    onChange={(e) => patchStroke({ width: Math.max(0, parseFloat(e.target.value) || 0) })}
                />
            </label>

            <label className="space-inspector-field space-inspector-field--full">
                <span>Alinhamento</span>
                <div className="inspector-segmented">
                    {ALIGN_OPTIONS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            className={
                                stroke.align === id || (!stroke.align && id === 'center')
                                    ? 'active'
                                    : ''
                            }
                            onClick={() => patchStroke({ align: id })}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </label>

            <label className="space-inspector-field space-inspector-field--full">
                <span>Estilo</span>
                <select
                    value={stroke.dash ?? 'solid'}
                    onChange={(e) => patchStroke({ dash: e.target.value })}
                >
                    {DASH_OPTIONS.map(({ id, label }) => (
                        <option key={id} value={id}>{label}</option>
                    ))}
                </select>
            </label>
        </InspectorSection>
    );
}
