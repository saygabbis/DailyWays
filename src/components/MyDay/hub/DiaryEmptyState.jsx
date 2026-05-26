export default function DiaryEmptyState({ title, description, action }) {
    return (
        <div className="diary-empty-state">
            <p className="diary-empty-title">{title}</p>
            {description && <p className="diary-empty-desc">{description}</p>}
            {action}
        </div>
    );
}
