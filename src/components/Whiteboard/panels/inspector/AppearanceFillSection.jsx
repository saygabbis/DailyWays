import React, { useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import InspectorSection from './InspectorSection.jsx';
import { useInspectorStylePatch } from './useInspectorStylePatch.js';
import { uploadSpaceAsset } from '../../../../services/whiteboardService';
import { useAuth } from '../../../../context/AuthContext';

export default function AppearanceFillSection({ node, spaceId }) {
    const { user } = useAuth();
    const fileRef = useRef(null);
    const { appearance, patchAppearance } = useInspectorStylePatch(node);
    if (!appearance) return null;

    const fill = appearance.fill ?? {};
    const hexColor = fill.color?.startsWith('#') ? fill.color : '#ffffff';

    const patchFill = (partial) => patchAppearance({ fill: { ...fill, ...partial } });

    const handleImageUpload = async (file) => {
        if (!file || !spaceId) return;
        const result = await uploadSpaceAsset(spaceId, file, user?.id);
        if (result?.url) {
            patchFill({ type: 'image', imageUrl: result.url, visible: true });
        }
    };

    return (
        <InspectorSection
            title="Preenchimento"
            actions={
                <button
                    type="button"
                    className="inspector-icon-btn"
                    title={fill.visible !== false ? 'Ocultar' : 'Mostrar'}
                    onClick={() => patchFill({ visible: fill.visible === false })}
                >
                    {fill.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            }
        >
            <label className="space-inspector-field space-inspector-field--full">
                <span>Tipo</span>
                <select
                    value={fill.type ?? 'color'}
                    onChange={(e) => patchFill({ type: e.target.value })}
                >
                    <option value="color">Cor</option>
                    <option value="image">Imagem</option>
                </select>
            </label>

            {fill.type === 'image' ? (
                <>
                    <div className="inspector-block-row">
                        <button
                            type="button"
                            className="inspector-text-btn"
                            onClick={() => fileRef.current?.click()}
                        >
                            Enviar imagem
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleImageUpload(f);
                                e.target.value = '';
                            }}
                        />
                    </div>
                    {fill.imageUrl ? (
                        <div className="inspector-fill-preview" style={{ backgroundImage: `url(${fill.imageUrl})` }} />
                    ) : null}
                    <label className="space-inspector-field space-inspector-field--full">
                        <span>Escala</span>
                        <select
                            value={fill.imageScale ?? 'fill'}
                            onChange={(e) => patchFill({ imageScale: e.target.value })}
                        >
                            <option value="fill">Preencher</option>
                            <option value="fit">Ajustar</option>
                        </select>
                    </label>
                </>
            ) : (
                <div className="inspector-block-row">
                    <input
                        type="color"
                        className="space-inspector-color-input inspector-swatch"
                        value={hexColor}
                        onChange={(e) => patchFill({ color: e.target.value, type: 'color' })}
                    />
                    <input
                        type="text"
                        className="inspector-hex-input"
                        value={hexColor.replace('#', '').toUpperCase()}
                        onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
                            if (raw.length === 6) patchFill({ color: `#${raw}`, type: 'color' });
                        }}
                    />
                    <input
                        type="number"
                        min={0}
                        max={100}
                        className="inspector-opacity-input"
                        value={fill.opacity ?? 100}
                        onChange={(e) => patchFill({ opacity: Number(e.target.value) })}
                    />
                    <span className="inspector-value-label">%</span>
                </div>
            )}
        </InspectorSection>
    );
}
