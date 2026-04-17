import {
  format,
  isPast,
  isThisWeek,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function parseCardDate(value) {
  if (!value) return null;

  const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

export function formatCardDate(value, options = {}) {
  const date = parseCardDate(value);
  if (!date) return '';

  const {
    pattern = 'dd MMM',
    locale = ptBR,
  } = options;

  return format(date, pattern, { locale });
}

export function formatCardDateTime(value, isAllDay = true) {
  const date = parseCardDate(value);
  if (!date) return '';
  return format(date, isAllDay ? 'dd MMM' : 'dd MMM HH:mm', { locale: ptBR });
}

export function isCardOverdue(card, now = new Date()) {
  const dueDate = parseCardDate(card?.dueDate);
  if (!dueDate || card?.completed) return false;

  if (card?.isAllDay ?? true) {
    const dueDay = startOfDay(dueDate);
    return isPast(dueDay) && !isToday(dueDay);
  }

  return dueDate.getTime() < now.getTime() && !isToday(dueDate);
}

export function isCardDueToday(card) {
  const dueDate = parseCardDate(card?.dueDate);
  return Boolean(dueDate && isToday(dueDate));
}

export function isCardDueTomorrow(card) {
  const dueDate = parseCardDate(card?.dueDate);
  return Boolean(dueDate && isTomorrow(dueDate));
}

export function isCardDueThisWeek(card) {
  const dueDate = parseCardDate(card?.dueDate);
  if (!dueDate) return false;
  return isThisWeek(dueDate, { weekStartsOn: 1 });
}

export function getCardTemporalBucket(card, now = new Date()) {
  const dueDate = parseCardDate(card?.dueDate);
  if (!dueDate) return 'no_due_date';

  if (isCardOverdue(card, now)) return 'overdue';
  if (isCardDueToday(card)) return 'today';
  if (isCardDueTomorrow(card)) return 'tomorrow';
  if (isCardDueThisWeek(card)) return 'this_week';
  return 'later';
}

export function getCardTimelineDayKey(card) {
  const dueDate = parseCardDate(card?.dueDate);
  if (!dueDate) return null;
  return format(dueDate, 'yyyy-MM-dd');
}
