import React from 'react';
import { Link2, Unlink } from 'lucide-react';
import InspectorSection from './InspectorSection.jsx';
import { useInspectorStylePatch } from './useInspectorStylePatch.js';

export default function AppearanceCornersSection({ node }) {
    const { appearance, patchAppearance } = useInspectorStylePatch(node);
    if (!appearance) return null;

    const linked = appearance.cornersLinked !== false;
    const ind = appearance.cornerRadiusIndividual ?? { tl: 0, tr: 0, br: 0, bl: 0 };

    const toggleLinked = () => {
        if (linked) {
            patchAppearance({
                cornersLinked: false,
                cornerRadiusIndividual: {
                    tl: appearance.cornerRadius ?? 0,
                    tr: appearance.cornerRadius ?? 0,
                    br: appearance.cornerRadius ?? 0,
                    bl: appearance.cornerRadius ?? 0,
                },
            });
        } else {
            patchAppearance({
                cornersLinked: true,
                cornerRadius: ind.tl ?? 0,
                cornerRadiusIndividual: null,
            });
        }
    };

    return (
        <InspectorSection
            title="Cantos"
            actions={
                <button
                    type="button"
                    className="inspector-icon-btn"
                    title={linked ? 'Cantos independentes' : 'Cantos iguais'}
                    onClick={toggleLinked}
                >
                    {linked ? <Link2 size={14} /> : <Unlink size={14} />}
                </button>
            }
        >
            {linked ? (
                <label className="space-inspector-field space-inspector-field--full">
                    <span>Arredondamento</span>
                    <input
                        type="number"
                        min={0}
                        value={appearance.cornerRadius ?? 0}
                        onChange={(e) => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0);
                            patchAppearance({ cornerRadius: v });
                        }}
                    />
                </label>
            ) : (
                <div className="space-inspector-grid">
                    {(['tl', 'tr', 'br', 'bl']).map((key) => (
                        <label key={key} className="space-inspector-field">
                            <span>{key.toUpperCase()}</span>
                            <input
                                type="number"
                                min={0}
                                value={ind[key] ?? 0}
                                onChange={(e) => {
                                    const v = Math.max(0, parseFloat(e.target.value) || 0);
                                    patchAppearance({
                                        cornerRadiusIndividual: { ...ind, [key]: v },
                                    });
                                }}
                            />
                        </label>
                    ))}
                </div>
            )}
        </InspectorSection>
    );
}
