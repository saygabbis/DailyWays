import React from 'react';
import InspectorSection from './InspectorSection.jsx';
import { useInspectorStylePatch } from './useInspectorStylePatch.js';
import { getToolMenuConfig } from '../toolbar/toolMenuRegistry.js';

export default function ShapeVariantSection({ node }) {
    const { patchData } = useInspectorStylePatch(node);
    if (!node || node.type !== 'shape') return null;

    const config = getToolMenuConfig('shape');
    const shape = node.data?.shape ?? 'rectangle';
    const polygonSides = node.data?.polygonSides ?? 6;

    return (
        <InspectorSection title="Forma">
            <label className="space-inspector-field space-inspector-field--full">
                <span>Tipo</span>
                <select
                    value={shape}
                    onChange={(e) => {
                        const next = e.target.value;
                        patchData({
                            shape: next,
                            polygonSides: next === 'polygon' ? polygonSides : undefined,
                        });
                    }}
                >
                    {(config?.variants ?? []).map(({ id, label }) => (
                        <option key={id} value={id}>{label}</option>
                    ))}
                </select>
            </label>

            {shape === 'polygon' && (
                <label className="space-inspector-field space-inspector-field--full">
                    <span>Lados</span>
                    <input
                        type="number"
                        min={3}
                        max={12}
                        value={polygonSides}
                        onChange={(e) => {
                            const v = Math.min(12, Math.max(3, parseInt(e.target.value, 10) || 6));
                            patchData({ polygonSides: v });
                        }}
                    />
                </label>
            )}
        </InspectorSection>
    );
}
