/** Opções fixas e helpers de apresentação do modal de tarefa. */
import { presenceHoverClass, presenceHoverStyle } from '../../hooks/useTaskModalPeerPresence.js';

export const RECURRENCE_OPTIONS = [
    { value: 'none', label: 'Não repetir' },
    { value: 'daily', label: 'Diariamente' },
    { value: 'weekdays', label: 'Dias úteis' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'monthly', label: 'Mensalmente' },
    { value: 'yearly', label: 'Anualmente' },
];

export const PRIORITY_OPTIONS = [
    { value: 'none', label: 'Nenhuma', color: 'var(--text-tertiary)' },
    { value: 'low', label: 'Baixa', color: '#3b82f6' },
    { value: 'medium', label: 'Média', color: '#f59e0b' },
    { value: 'high', label: 'Alta', color: '#f97316' },
    { value: 'urgent', label: 'Urgente', color: '#ef4444' },
];

/** Props de "hover de presença" (destaca o campo que um colega está olhando). */
export function ph(hoverByEl, key, baseClass = '', baseStyle = {}) {
    return {
        'data-presence-hover': key,
        className: presenceHoverClass(hoverByEl, key, baseClass),
        style: presenceHoverStyle(hoverByEl, key, baseStyle),
    };
}
