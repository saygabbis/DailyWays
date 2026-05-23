/**
 * FIFO para deduplicação de opIds.
 * Descarta só as entradas mais antigas quando cheio — nunca limpa tudo de uma vez.
 */
export function createOpIdTracker(maxSize = 5000) {
  const ids = new Set();
  const queue = [];
  return {
    has(id) {
      return ids.has(id);
    },
    add(id) {
      if (ids.has(id)) return;
      if (queue.length >= maxSize) {
        const oldest = queue.shift();
        ids.delete(oldest);
      }
      ids.add(id);
      queue.push(id);
    },
    get size() {
      return queue.length;
    },
  };
}
