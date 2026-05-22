import { useMemo, useState } from 'react';
import { Clock, X } from 'lucide-react';
import DatePicker from './DatePicker';
import { presenceHoverClass, presenceHoverStyle } from '../../hooks/useTaskModalPeerPresence.js';

function toTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function mergeDateAndTime(dateValue, timeValue, isAllDay) {
  if (!dateValue) return null;
  if (isAllDay || !timeValue) return new Date(`${dateValue}T00:00:00`).toISOString();
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

export default function TaskDateTimeField({
  label,
  value,
  onChange,
  isAllDay = true,
  onToggleAllDay,
  allowTime = true,
  placeholder = 'dd/mm/aaaa',
  hoverByEl = null,
  presenceKey = 'date',
}) {
  const [timeValue, setTimeValue] = useState(() => toTimeInputValue(value));

  const dateValue = useMemo(() => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, [value]);

  const handleDateChange = (nextDate) => {
    onChange(mergeDateAndTime(nextDate, timeValue, isAllDay));
  };

  const handleTimeChange = (event) => {
    const nextTime = event.target.value;
    setTimeValue(nextTime);
    onChange(mergeDateAndTime(dateValue, nextTime, isAllDay));
  };

  const handleClear = () => {
    setTimeValue('');
    onChange(null);
  };

  const toggleKey = `${presenceKey}-toggle`;
  const dateKey = `${presenceKey}-date`;
  const timeKey = `${presenceKey}-time`;
  const clearKey = `${presenceKey}-clear`;

  return (
    <div className="task-datetime-field">
      <div className="task-datetime-field-head">
        <label>{label}</label>
        {allowTime && onToggleAllDay && (
          <button
            type="button"
            data-presence-hover={toggleKey}
            className={presenceHoverClass(hoverByEl, toggleKey, `task-datetime-toggle ${isAllDay ? 'active' : ''}`)}
            style={presenceHoverStyle(hoverByEl, toggleKey)}
            onClick={onToggleAllDay}
          >
            <Clock size={14} />
            <span>{isAllDay ? 'Dia inteiro' : 'Com horário'}</span>
          </button>
        )}
      </div>
      <div className="task-datetime-inputs">
        <div
          data-presence-hover={dateKey}
          className={presenceHoverClass(hoverByEl, dateKey, 'task-datetime-date-wrap')}
          style={presenceHoverStyle(hoverByEl, dateKey)}
        >
          <DatePicker value={dateValue} onChange={handleDateChange} placeholder={placeholder} />
        </div>
        {allowTime && !isAllDay && (
          <input
            type="time"
            data-presence-hover={timeKey}
            className={presenceHoverClass(hoverByEl, timeKey, 'task-datetime-time')}
            style={presenceHoverStyle(hoverByEl, timeKey)}
            value={timeValue}
            onChange={handleTimeChange}
          />
        )}
        {value && (
          <button
            type="button"
            data-presence-hover={clearKey}
            className={presenceHoverClass(hoverByEl, clearKey, 'task-datetime-clear')}
            style={presenceHoverStyle(hoverByEl, clearKey)}
            onClick={handleClear}
            title="Limpar data"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
