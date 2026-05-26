export default function DiaryStatChip({ icon: Icon, value, label, hint }) {
    return (
        <div className="diary-stat-chip">
            {Icon && <Icon size={16} className="diary-stat-chip-icon" strokeWidth={2} />}
            <div className="diary-stat-chip-body">
                <span className="diary-stat-chip-value">{value}</span>
                <span className="diary-stat-chip-label">{label}</span>
                {hint && <span className="diary-stat-chip-hint">{hint}</span>}
            </div>
        </div>
    );
}
