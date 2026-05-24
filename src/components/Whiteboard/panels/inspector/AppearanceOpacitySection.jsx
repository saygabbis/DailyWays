import React from 'react';
import InspectorSection from './InspectorSection.jsx';
import { useInspectorStylePatch } from './useInspectorStylePatch.js';

export default function AppearanceOpacitySection({ node }) {
    const { appearance, patchAppearance } = useInspectorStylePatch(node);
    if (!appearance) return null;

    return (
        <InspectorSection title="Aparência">
            <label className="space-inspector-field space-inspector-field--full">
                <span>Opacidade</span>
                <div className="inspector-block-row">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={appearance.opacity ?? 100}
                        onChange={(e) => patchAppearance({ opacity: Number(e.target.value) })}
                    />
                    <span className="inspector-value-label">{appearance.opacity ?? 100}%</span>
                </div>
            </label>
        </InspectorSection>
    );
}
