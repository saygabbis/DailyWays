import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './DatePicker.css';

const MONTH_NAMES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];
const DAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function toDateInputValue(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isSameDay(a, b) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function isToday(date) {
    return isSameDay(date, new Date());
}

export default function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa' }) {
    const selected = parseLocalDate(value);
    const today = new Date();

    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());
    const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());
    const [showYearPicker, setShowYearPicker] = useState(false);

    const containerRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setShowYearPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Sync view when value changes externally
    useEffect(() => {
        if (selected) {
            setViewYear(selected.getFullYear());
            setViewMonth(selected.getMonth());
        }
    }, [value]);

    const handleToggle = () => {
        setOpen(prev => !prev);
        setShowYearPicker(false);
    };

    const prevMonth = () => {
        setViewMonth(m => {
            if (m === 0) { setViewYear(y => y - 1); return 11; }
            return m - 1;
        });
    };

    const nextMonth = () => {
        setViewMonth(m => {
            if (m === 11) { setViewYear(y => y + 1); return 0; }
            return m + 1;
        });
    };

    const handleSelectDay = (date) => {
        onChange(toDateInputValue(date));
        setOpen(false);
        setShowYearPicker(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
    };

    const handleToday = () => {
        const t = new Date();
        setViewYear(t.getFullYear());
        setViewMonth(t.getMonth());
        handleSelectDay(t);
    };

    const handleSelectYear = (year) => {
        setViewYear(year);
        setShowYearPicker(false);
    };

    // Build calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    // Prev month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        cells.push({ day: daysInPrevMonth - i, currentMonth: false, prev: true });
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, currentMonth: true });
    }
    // Next month leading days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, currentMonth: false, next: true });
    }

    // Formatted display value
    const displayValue = selected
        ? `${String(selected.getDate()).padStart(2, '0')}/${String(selected.getMonth() + 1).padStart(2, '0')}/${selected.getFullYear()}`
        : '';

    // Year range for year picker
    const yearStart = Math.floor(viewYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

    return (
        <div className="dp-wrapper" ref={containerRef}>
            {/* Trigger */}
            <button
                type="button"
                className={`dp-trigger ${open ? 'open' : ''} ${selected ? 'has-value' : ''}`}
                onClick={handleToggle}
            >
                <span className={`dp-trigger-text ${!displayValue ? 'placeholder' : ''}`}>
                    {displayValue || placeholder}
                </span>
                {selected ? (
                    <span className="dp-clear-btn" onClick={handleClear} title="Limpar">
                        <X size={13} />
                    </span>
                ) : (
                    <span className="dp-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </span>
                )}
            </button>

            {/* Popup */}
            {open && (
                <div className="dp-popup animate-pop-in">
                    {showYearPicker ? (
                        /* Year Picker */
                        <div className="dp-year-picker">
                            <div className="dp-nav">
                                <button className="dp-nav-btn" onClick={() => setViewYear(y => y - 12)}>
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="dp-nav-label">{yearStart} – {yearStart + 11}</span>
                                <button className="dp-nav-btn" onClick={() => setViewYear(y => y + 12)}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="dp-year-grid">
                                {years.map(y => (
                                    <button
                                        key={y}
                                        className={`dp-year-cell ${y === viewYear ? 'selected' : ''} ${y === today.getFullYear() ? 'today' : ''}`}
                                        onClick={() => handleSelectYear(y)}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Calendar Picker */
                        <>
                            <div className="dp-nav">
                                <button className="dp-nav-btn" onClick={prevMonth}>
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    className="dp-nav-label dp-month-btn"
                                    onClick={() => setShowYearPicker(true)}
                                    title="Selecionar ano"
                                >
                                    {MONTH_NAMES[viewMonth]} de {viewYear}
                                    <ChevronRight size={12} style={{ transform: 'rotate(90deg)', opacity: 0.5 }} />
                                </button>
                                <button className="dp-nav-btn" onClick={nextMonth}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div className="dp-day-headers">
                                {DAY_NAMES.map((d, i) => (
                                    <span key={i} className="dp-day-header">{d}</span>
                                ))}
                            </div>

                            <div className="dp-grid">
                                {cells.map((cell, idx) => {
                                    const cellDate = cell.prev
                                        ? new Date(viewYear, viewMonth - 1, cell.day)
                                        : cell.next
                                            ? new Date(viewYear, viewMonth + 1, cell.day)
                                            : new Date(viewYear, viewMonth, cell.day);

                                    const sel = isSameDay(cellDate, selected);
                                    const tod = isToday(cellDate);

                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            className={[
                                                'dp-cell',
                                                !cell.currentMonth && 'other-month',
                                                sel && 'selected',
                                                tod && !sel && 'today',
                                            ].filter(Boolean).join(' ')}
                                            onClick={() => handleSelectDay(cellDate)}
                                        >
                                            {cell.day}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="dp-footer">
                                <button className="dp-footer-btn" onClick={() => onChange('')}>Limpar</button>
                                <button className="dp-footer-btn accent" onClick={handleToday}>Hoje</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
