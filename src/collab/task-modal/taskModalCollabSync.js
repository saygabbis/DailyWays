/**
 * Evita loop liveDraft ↔ UPDATE_CARD no modal da task.
 */

export function createRemoteSyncLock() {
  let depth = 0;
  return {
    isLocked: () => depth > 0,
    run(fn) {
      depth += 1;
      try {
        fn();
      } finally {
        depth -= 1;
      }
    },
  };
}

/** Campos que só entram via UPDATE_CARD (estado autoritativo), não via liveDraft. */
export const MODAL_STRUCTURE_FIELDS = new Set([
  'priority',
  'startDate',
  'dueDate',
  'recurrenceRule',
  'isAllDay',
  'myDay',
  'dayCategory',
  'estimatedMinutes',
  'labels',
  'cardColor',
]);
