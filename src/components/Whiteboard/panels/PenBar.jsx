/** Cor e espessura da caneta (aparece acima da barra de ferramentas enquanto a caneta está ativa). */
const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#111827', '#f8fafc'];
const SIZES = [
    { id: 2, label: 'Fina' },
    { id: 4, label: 'Média' },
    { id: 8, label: 'Grossa' },
];

export default function PenBar({ pen, onChange }) {
    return (
        <div className="whiteboard-pen-bar" role="toolbar" aria-label="Caneta" onPointerDown={(e) => e.stopPropagation()}>
            {COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    className={`whiteboard-pen-swatch ${pen.color === c ? 'is-active' : ''}`}
                    style={{ '--pen-color': c }}
                    aria-label={`Cor ${c}`}
                    aria-pressed={pen.color === c}
                    onClick={() => onChange({ ...pen, color: c })}
                />
            ))}
            <span className="whiteboard-pen-sep" aria-hidden />
            {SIZES.map((s) => (
                <button
                    key={s.id}
                    type="button"
                    className={`whiteboard-pen-size ${pen.size === s.id ? 'is-active' : ''}`}
                    aria-label={`Espessura ${s.label}`}
                    aria-pressed={pen.size === s.id}
                    title={s.label}
                    onClick={() => onChange({ ...pen, size: s.id })}
                >
                    <span style={{ width: s.id + 4, height: s.id + 4 }} />
                </button>
            ))}
        </div>
    );
}
