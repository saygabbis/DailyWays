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

