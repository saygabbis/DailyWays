import { useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import InspectorSection from './InspectorSection.jsx';
import InspectorColorField from './InspectorColorField.jsx';
import InspectorSegmentedField from './InspectorSegmentedField.jsx';
import { useInspectorStylePatch } from './useInspectorStylePatch.js';
import { uploadSpaceAsset } from '../../../../services/whiteboardService';
import { useAuth } from '../../../../context/AuthContext';
import { useSpaceAssetUrl } from '../../../../hooks/useSpaceAssetUrl';

export default function AppearanceFillSection({ node, spaceId }) {
    const { user } = useAuth();
    const fileRef = useRef(null);
    const { appearance, patchAppearance } = useInspectorStylePatch(node);
    const fill = appearance?.fill ?? {};
    // Hook antes de qualquer return: chamado sempre, na mesma ordem.
    const previewUrl = useSpaceAssetUrl(
        fill.type === 'image'
            ? { storagePath: fill.imageStoragePath, url: fill.imageUrl }
            : null,
    );
    if (!appearance) return null;
    const hexColor = fill.color?.startsWith('#') ? fill.color : '#ffffff';

    const patchFill = (partial) => patchAppearance({ fill: { ...fill, ...partial } });

    const handleImageUpload = async (file) => {
        if (!file || !spaceId) return;
        const result = await uploadSpaceAsset(spaceId, file, user?.id);
        if (result?.storagePath) {
            patchFill({
                type: 'image',
                imageStoragePath: result.storagePath,
                imageUrl: null,
                visible: true,
            });
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
            <InspectorSegmentedField
                label="Tipo"
                value={fill.type ?? 'color'}
                options={[
                    { id: 'color', label: 'Cor' },
                    { id: 'image', label: 'Imagem' },
                ]}
                onChange={(id) => patchFill({ type: id })}
            />

            {fill.type === 'image' ? (
                <>
                    <div className="inspector-field inspector-field--full">
                        <span className="inspector-field-label">Arquivo</span>
                        <button
                            type="button"
                            className="inspector-text-btn inspector-field-control"
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
                    {previewUrl ? (
                        <div className="inspector-fill-preview" style={{ backgroundImage: `url(${previewUrl})` }} />
                    ) : null}
                    <InspectorSegmentedField
                        label="Escala"
                        value={fill.imageScale ?? 'fill'}
                        options={[
                            { id: 'fill', label: 'Preencher' },
                            { id: 'fit', label: 'Ajustar' },
                        ]}
                        onChange={(id) => patchFill({ imageScale: id })}
                    />
                </>
            ) : (
                <InspectorColorField
                    color={hexColor}
                    opacity={fill.opacity ?? 100}
                    onColorChange={(c) => patchFill({ color: c, type: 'color' })}
                    onOpacityChange={(v) => patchFill({ opacity: v })}
                />
            )}
        </InspectorSection>
    );
}
