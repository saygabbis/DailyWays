
/** Rótulo + grupo de botões segmentados (substitui selects nativos). */
export default function InspectorSegmentedField({ label, value, options, onChange }) {
    return (
        <label className="inspector-field inspector-field--full">
            <span className="inspector-field-label">{label}</span>
            <div className="inspector-segmented inspector-field-control">
                {options.map(({ id, label: optLabel }) => (
                    <button
                        key={id}
                        type="button"
                        className={value === id || (!value && id === options[0]?.id) ? 'active' : ''}
                        onClick={() => onChange(id)}
                    >
                        {optLabel}
                    </button>
                ))}
            </div>
        </label>
    );
}
