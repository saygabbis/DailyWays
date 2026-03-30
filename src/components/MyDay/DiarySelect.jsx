import {
    useState,
    useRef,
    useEffect,
    useLayoutEffect,
    useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * Select estilizado (lista custom) — evita o menu nativo feio do <select>.
 * Menu em portal + position fixed para não ser cortado por overflow dos pais.
 */
export default function DiarySelect({
    value,
    onChange,
    options = [],
    disabled = false,
    variant = 'default',
    emptyLabel = '—',
    id,
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);
    const [menuStyle, setMenuStyle] = useState({});

    const selected = options.find((o) => o.value === value);
    const selectedLabel =
        options.length === 0 ? emptyLabel : selected?.label ?? '—';

    const updatePosition = useCallback(() => {
        const t = wrapRef.current;
        const menu = menuRef.current;
        if (!t || !open) return;
        const rect = t.getBoundingClientRect();
        const gap = 6;
        const estH = menu?.offsetHeight ?? 240;
        let top = rect.bottom + gap;
        if (top + estH > window.innerHeight - 10) {
            top = Math.max(10, rect.top - estH - gap);
        }
        let left = rect.left;
        const w = Math.max(rect.width, 160);
        if (left + w > window.innerWidth - 10) {
            left = Math.max(10, window.innerWidth - w - 10);
        }
        setMenuStyle({
            position: 'fixed',
            top,
            left,
            width: w,
            zIndex: 250,
        });
    }, [open]);

    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
        const idRaf = requestAnimationFrame(() => {
            updatePosition();
        });
        return () => cancelAnimationFrame(idRaf);
    }, [open, updatePosition, options.length]);

    useEffect(() => {
        if (!open) return;
        const onScroll = () => updatePosition();
        window.addEventListener('resize', onScroll);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            window.removeEventListener('resize', onScroll);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (wrapRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const handleToggle = () => {
        if (disabled || options.length === 0) return;
        setOpen((v) => !v);
    };

    const handlePick = (v) => {
        onChange(v);
        setOpen(false);
    };

    const menuNode =
        open &&
        !disabled &&
        options.length > 0 &&
        createPortal(
            <div
                ref={menuRef}
                className="diary-select-menu"
                style={menuStyle}
                role="listbox"
                id={id ? `${id}-listbox` : undefined}
            >
                {options.map((o) => (
                    <button
                        key={String(o.value)}
                        type="button"
                        className={`diary-select-item ${o.value === value ? 'active' : ''}`}
                        role="option"
                        aria-selected={o.value === value}
                        onClick={() => handlePick(o.value)}
                    >
                        {o.label}
                    </button>
                ))}
            </div>,
            document.body
        );

    return (
        <div
            className={`diary-select-wrap ${variant === 'mini' ? 'diary-select-wrap--mini' : ''}`}
            ref={wrapRef}
        >
            <button
                type="button"
                id={id}
                className="diary-select-trigger"
                onClick={handleToggle}
                disabled={disabled || options.length === 0}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={id ? `${id}-listbox` : undefined}
            >
                <span className="diary-select-trigger-label">{selectedLabel}</span>
                <ChevronDown
                    size={variant === 'mini' ? 14 : 16}
                    strokeWidth={2}
                    className={`diary-select-chevron ${open ? 'open' : ''}`}
                    aria-hidden
                />
            </button>
            {menuNode}
        </div>
    );
}
