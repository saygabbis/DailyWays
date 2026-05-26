export default function DiaryGlassCard({ className = '', children, as: Tag = 'section', ...props }) {
    return (
        <Tag className={`diary-glass-card ${className}`.trim()} {...props}>
            {children}
        </Tag>
    );
}
