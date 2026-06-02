import React from 'react';

/** Campo de cor com swatch circular, hex e opacidade. */
export default function InspectorColorField({
    color,
    opacity = 100,
    onColorChange,
    onOpacityChange,
    showOpacity = true,
}) {
    const hex = color?.startsWith('#') ? color : '#000000';

    return (
        <div className="inspector-color-field">
            <label
                className="inspector-color-swatch-wrap"
                title="Escolher cor"
                style={{ '--swatch-color': hex }}
            >
                <span className="inspector-color-swatch-preview" aria-hidden />
                <input
                    type="color"
                    value={hex}
                    onChange={(e) => onColorChange?.(e.target.value)}
                />
            </label>
            <div className="inspector-color-meta">
                <input
                    type="text"
                    className="inspector-hex-input"
                    value={hex.replace('#', '').toUpperCase()}
                    spellCheck={false}
                    onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
                        if (raw.length === 6) onColorChange?.(`#${raw}`);
                    }}
                />
                {showOpacity ? (
                    <div className="inspector-opacity-group">
                        <input
                            type="number"
                            min={0}
                            max={100}
                            className="inspector-opacity-input"
                            value={opacity ?? 100}
                            onChange={(e) => onOpacityChange?.(Number(e.target.value))}
                        />
                        <span className="inspector-value-label">%</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
