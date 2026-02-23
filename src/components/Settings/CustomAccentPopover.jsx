import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CustomAccentPopover.css';

const POPOVER_OFFSET = 8;

function hexToRgb(hex) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 124, g: 58, b: 237 };
}
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const h = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return h.length === 1 ? '0' + h : h;
    }).join('');
}

const DEFAULT_STOPS = [
    { color: '#7c3aed', position: 0 },
    { color: '#06b6d4', position: 100 },
];

export default function CustomAccentPopover({ anchorRef, value, onApply, onClose }) {
    const [mode, setMode] = useState(value?.type === 'gradient' ? 'gradient' : 'solid');
    const [solidColor, setSolidColor] = useState(value?.type === 'solid' ? value.color : '#7c3aed');
    const [rgb, setRgb] = useState(() => hexToRgb(value?.type === 'solid' ? value.color : '#7c3aed'));
    const [stops, setStops] = useState(() => {
        if (value?.type === 'gradient' && Array.isArray(value.stops) && value.stops.length >= 2)
            return value.stops.map(s => ({ color: s.color, position: s.position ?? 0 }));
        return [...DEFAULT_STOPS];
    });
    const popoverRef = useRef(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (anchorRef?.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top - POPOVER_OFFSET,
                left: rect.left,
            });
        }
    }, [anchorRef]);

    useEffect(() => {
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target) && anchorRef?.current && !anchorRef.current.contains(e.target))
                onClose?.();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose, anchorRef]);

    const applySolid = () => {
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        onApply({ type: 'solid', color: hex });
    };

    const applyGradient = () => {
        const sorted = [...stops].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        onApply({ type: 'gradient', stops: sorted });
    };

    const handleSolidColorChange = (e) => {
        const hex = e.target.value;
        setSolidColor(hex);
        setRgb(hexToRgb(hex));
        onApply({ type: 'solid', color: hex });
    };

    const handleRgbChange = (channel, v) => {
        const n = Math.max(0, Math.min(255, parseInt(v, 10) || 0));
        const next = { ...rgb, [channel]: n };
        setRgb(next);
        const hex = rgbToHex(next.r, next.g, next.b);
        setSolidColor(hex);
        onApply({ type: 'solid', color: hex });
    };

    const handleStopColor = (index, hex) => {
        const next = stops.map((s, i) => i === index ? { ...s, color: hex } : s);
        setStops(next);
        onApply({ type: 'gradient', stops: next });
    };

    const handleStopPosition = (index, pos) => {
        const next = stops.map((s, i) => i === index ? { ...s, position: Math.max(0, Math.min(100, pos)) } : s);
        setStops(next);
        onApply({ type: 'gradient', stops: next });
    };

    const addStop = () => {
        if (stops.length >= 3) return;
        const newPos = stops.length === 0 ? 50 : (stops[stops.length - 1].position + 50) / 2;
        const next = [...stops, { color: '#a855f7', position: Math.min(100, newPos) }].sort((a, b) => a.position - b.position);
        setStops(next);
        onApply({ type: 'gradient', stops: next });
    };

    const removeStop = (index) => {
        if (stops.length <= 2) return;
        const next = stops.filter((_, i) => i !== index);
        setStops(next);
        onApply({ type: 'gradient', stops: next });
    };

    const content = (
        <div ref={popoverRef} className="custom-accent-popover animate-pop-in" style={{ top: position.top, left: position.left, transform: 'translateY(-100%)' }} onClick={e => e.stopPropagation()}>
            <div className="custom-accent-popover-header">
                <span className="custom-accent-popover-title">Cor personalizada</span>
            </div>
            <div className="custom-accent-popover-tabs">
                <button type="button" className={mode === 'solid' ? 'active' : ''} onClick={() => { setMode('solid'); onApply({ type: 'solid', color: solidColor }); }}>Cor sólida</button>
                <button type="button" className={mode === 'gradient' ? 'active' : ''} onClick={() => { setMode('gradient'); if (stops.length >= 2) onApply({ type: 'gradient', stops }); }}>Gradiente</button>
            </div>
            <div className="custom-accent-popover-body">
                {mode === 'solid' ? (
                    <>
                        <div className="custom-accent-row">
                            <label>Cor</label>
                            <input type="color" value={solidColor} onChange={handleSolidColorChange} className="custom-accent-color-input" />
                        </div>
                        <div className="custom-accent-rgb">
                            <label>RGB</label>
                            <div className="custom-accent-rgb-inputs">
                                <input type="number" min="0" max="255" value={rgb.r} onChange={e => handleRgbChange('r', e.target.value)} placeholder="R" />
                                <input type="number" min="0" max="255" value={rgb.g} onChange={e => handleRgbChange('g', e.target.value)} placeholder="G" />
                                <input type="number" min="0" max="255" value={rgb.b} onChange={e => handleRgbChange('b', e.target.value)} placeholder="B" />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {stops.map((stop, i) => (
                            <div key={i} className="custom-accent-stop">
                                <div className="custom-accent-stop-color">
                                    <input type="color" value={stop.color} onChange={e => handleStopColor(i, e.target.value)} />
                                    <span className="custom-accent-stop-label">Cor {i + 1}</span>
                                </div>
                                <div className="custom-accent-stop-pos">
                                    <input type="range" min="0" max="100" value={stop.position} onChange={e => handleStopPosition(i, parseInt(e.target.value, 10))} />
                                    <span>{Math.round(stop.position)}%</span>
                                </div>
                                {stops.length > 2 && <button type="button" className="custom-accent-remove-stop" onClick={() => removeStop(i)} title="Remover">×</button>}
                            </div>
                        ))}
                        {stops.length < 3 && (
                            <button type="button" className="custom-accent-add-stop" onClick={addStop}>+ Adicionar cor</button>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
