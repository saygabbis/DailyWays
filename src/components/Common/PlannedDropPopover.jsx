import { useState } from 'react';
import { Calendar, Sun, ArrowRight, CalendarDays, X } from 'lucide-react';
import { addDays, nextMonday, format } from 'date-fns';
import DatePicker from './DatePicker';
import './PlannedDropPopover.css';

export default function PlannedDropPopover({ cardTitle, onSelectDate, onClose }) {
    const [showCustom, setShowCustom] = useState(false);
    const today = new Date();

    const quickOptions = [
        {
            label: 'Hoje',
            icon: <Sun size={16} />,
            date: format(today, 'yyyy-MM-dd'),
            color: 'var(--accent-primary)',
        },
        {
            label: 'Amanhã',
            icon: <ArrowRight size={16} />,
            date: format(addDays(today, 1), 'yyyy-MM-dd'),
            color: 'var(--success)',
        },
        {
            label: 'Próxima semana',
            icon: <CalendarDays size={16} />,
            date: format(nextMonday(today), 'yyyy-MM-dd'),
            color: 'var(--info)',
        },
    ];

    return (
        <>
            <div className="planned-drop-backdrop" onClick={onClose} />
            <div className="planned-drop-popover animate-scale-in-centered">
                <div className="planned-drop-header">
                    <Calendar size={18} />
                    <div className="planned-drop-header-text">
                        <span className="planned-drop-title">Definir data</span>
                        <span className="planned-drop-card-name">{cardTitle}</span>
                    </div>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                {!showCustom ? (
                    <div className="planned-drop-options">
                        {quickOptions.map(opt => (
                            <button
                                key={opt.label}
                                className="planned-drop-option"
                                onClick={() => onSelectDate(opt.date)}
                            >
                                <span className="planned-drop-option-icon" style={{ color: opt.color }}>
                                    {opt.icon}
                                </span>
                                <span>{opt.label}</span>
                                <span className="planned-drop-option-date">
                                    {format(new Date(opt.date), 'dd/MM')}
                                </span>
                            </button>
                        ))}
                        <button
                            className="planned-drop-option custom"
                            onClick={() => setShowCustom(true)}
                        >
                            <span className="planned-drop-option-icon" style={{ color: 'var(--text-tertiary)' }}>
                                <Calendar size={16} />
                            </span>
                            <span>Escolher data...</span>
                        </button>
                    </div>
                ) : (
                    <div className="planned-drop-custom">
                        <DatePicker
                            value=""
                            onChange={(date) => {
                                if (date) onSelectDate(date);
                            }}
                            placeholder="dd/mm/aaaa"
                        />
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowCustom(false)}>
                            ← Voltar
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
