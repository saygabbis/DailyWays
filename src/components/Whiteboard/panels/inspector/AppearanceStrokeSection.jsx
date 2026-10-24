import { Eye, EyeOff } from 'lucide-react';
import InspectorSection from './InspectorSection.jsx';
import InspectorColorField from './InspectorColorField.jsx';
import InspectorSegmentedField from './InspectorSegmentedField.jsx';
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

const IMAGE_OUTLINE_OPTIONS = [
    { id: 'solid', label: 'Contorno' },
    { id: 'soft', label: 'Suave' },
    { id: 'glow', label: 'Brilho' },
    { id: 'double', label: 'Dupla' },
];

export default function AppearanceStrokeSection({ node }) {
    const { appearance, patchAppearance } = useInspectorStylePatch(node);
    if (!appearance) return null;

    const isImage = node?.type === 'image';
    const stroke = appearance.stroke ?? {};
    const hexColor = stroke.color?.startsWith('#') ? stroke.color : '#000000';
    const smoothness = stroke.smoothness ?? 40;
    const outlineStyle = stroke.outlineStyle ?? stroke.dash ?? 'solid';

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
            <InspectorColorField
                color={hexColor}
                opacity={stroke.opacity ?? 100}
                onColorChange={(c) => patchStroke({ color: c })}
                onOpacityChange={(v) => patchStroke({ opacity: v })}
            />

            <label className="inspector-field inspector-field--full">
                <span className="inspector-field-label">Espessura</span>
                <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="inspector-field-control"
                    value={stroke.width ?? 1}
                    onChange={(e) => patchStroke({ width: Math.max(0, parseFloat(e.target.value) || 0) })}
                />
            </label>

            <InspectorSegmentedField
                label="Alinhamento"
                value={stroke.align ?? 'center'}
                options={ALIGN_OPTIONS}
                onChange={(id) => patchStroke({ align: id })}
            />

            {isImage ? (
                <>
                    <InspectorSegmentedField
                        label="Estilo"
                        value={outlineStyle}
                        options={IMAGE_OUTLINE_OPTIONS}
                        onChange={(id) => patchStroke({ outlineStyle: id })}
                    />
                    <label className="inspector-field inspector-field--full">
                        <span className="inspector-field-label">
                            Suavização
                            <span className="inspector-field-value">{smoothness}%</span>
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            className="inspector-range"
                            value={smoothness}
                            onChange={(e) => patchStroke({ smoothness: Number(e.target.value) })}
                        />
                        <span className="inspector-field-hint">0 = borda dura · 100 = borda alisada</span>
                    </label>
                </>
            ) : (
                <InspectorSegmentedField
                    label="Estilo"
                    value={stroke.dash ?? 'solid'}
                    options={DASH_OPTIONS}
                    onChange={(id) => patchStroke({ dash: id })}
                />
            )}
        </InspectorSection>
    );
}
