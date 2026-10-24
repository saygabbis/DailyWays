import InspectorSection from './InspectorSection.jsx';
import { useInspectorStylePatch } from './useInspectorStylePatch.js';

export default function AppearanceOpacitySection({ node }) {
    const { appearance, patchAppearance } = useInspectorStylePatch(node);
    if (!appearance) return null;

    const opacity = appearance.opacity ?? 100;

    return (
        <InspectorSection title="Aparência">
            <label className="inspector-field inspector-field--full">
                <span className="inspector-field-label">
                    Opacidade
                    <span className="inspector-field-value">{opacity}%</span>
                </span>
                <input
                    type="range"
                    min={0}
                    max={100}
                    className="inspector-range"
                    value={opacity}
                    onChange={(e) => patchAppearance({ opacity: Number(e.target.value) })}
                />
            </label>
        </InspectorSection>
    );
}
