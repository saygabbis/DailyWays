import { useRef, useEffect } from 'react';
import './Sidebar.css';

/** "Corrente" de itens que segue o cursor ao arrastar vários boards/spaces selecionados. */
const BulkDragFollowers = ({ count, items = [] }) => {
    const containerRef = useRef(null);
    const positionsRef = useRef([]);
    const mouseRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);

    const maxFollowers = Math.min(count - 1, 8);
    const followers = items.slice(0, maxFollowers);
    const hasMore = count - 1 > maxFollowers;
    const totalCards = maxFollowers + (hasMore ? 1 : 0);

    useEffect(() => {
        if (count <= 1) return;

        let initialized = false;

        const handleMouseMove = (e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
            if (!initialized) {
                // Seed all positions from the first real mouse position
                positionsRef.current = Array.from({ length: totalCards }, () => ({ x: e.clientX, y: e.clientY }));
                initialized = true;
            }
        };

        const animate = () => {
            if (!initialized) { rafRef.current = requestAnimationFrame(animate); return; }

            const cards = containerRef.current?.children;
            if (!cards) { rafRef.current = requestAnimationFrame(animate); return; }

            const mouse = mouseRef.current;
            const positions = positionsRef.current;

            for (let i = 0; i < totalCards; i++) {
                const card = cards[i];
                if (!card || card.classList.contains('bulk-drag-badge')) continue;

                // Each card follows the one above it (or mouse for the first)
                const target = i === 0 ? mouse : positions[i - 1];
                const smoothing = Math.max(0.35 - (i * 0.025), 0.12);

                positions[i].x += (target.x - positions[i].x) * smoothing;
                positions[i].y += (target.y - positions[i].y) * smoothing;

                // Cards are position:absolute, offsetY = absolute Y position
                // First card 38px below dragged item, then gap shrinks: 6, 4, 3, 2, 2...
                const cardH = 28;
                let offsetY = 38;
                for (let j = 0; j < i; j++) {
                    const gap = Math.max(6 - j * 1.5, 2);
                    offsetY += cardH + gap;
                }

                card.style.transform = `translate(${positions[i].x - mouse.x}px, ${positions[i].y - mouse.y + offsetY}px)`;
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        document.addEventListener('mousemove', handleMouseMove);
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [count, totalCards]);

    if (count <= 1) return null;

    return (
        <div className="bulk-chain-container" ref={containerRef}>
            {followers.map((item, idx) => (
                <div key={item?.id || idx} className="bulk-chain-card">
                    <span className="bulk-chain-dot" style={{ background: item?.color || 'var(--text-tertiary)' }} />
                    <span className="bulk-chain-label">{item?.emoji} {item?.title || '...'}</span>
                </div>
            ))}
            {hasMore && (
                <div className="bulk-chain-card bulk-chain-ellipsis">
                    <span className="bulk-chain-label">•••</span>
                </div>
            )}
            <div className="bulk-drag-badge">{count}</div>
        </div>
    );
};

export default BulkDragFollowers;
