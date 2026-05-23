/**
 * Camadas visuais atrás do card principal durante arrasto multiseleção.
 * O DnD só move um Draggable; isto comunica que vários cards vão juntos.
 */
export default function BoardMultiDragStack({ count, items = [], variant = 'local' }) {
    if (count <= 1) return null;

    const layerCount = Math.min(2, count - 1, items.length);
    const extra = count - 1 - layerCount;
    const rootClass = [
        'board-multi-drag-stack',
        variant === 'remote' ? 'board-multi-drag-stack--remote' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={rootClass} aria-hidden>
            {Array.from({ length: layerCount }).map((_, i) => {
                const item = items[i];
                return (
                    <div
                        key={item?.id ?? `layer-${i}`}
                        className={`board-multi-drag-stack__layer board-multi-drag-stack__layer--${i + 1}`}
                    >
                        {item?.title ? (
                            <span className="board-multi-drag-stack__title">{item.title}</span>
                        ) : null}
                    </div>
                );
            })}
            {extra > 0 && (
                <div className="board-multi-drag-stack__layer board-multi-drag-stack__layer--more">
                    <span className="board-multi-drag-stack__more">+{extra}</span>
                </div>
            )}
        </div>
    );
}
