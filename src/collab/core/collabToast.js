const TOAST_DEBOUNCE_MS = 2000;
let lastCollabToastAt = 0;

/** Evita rajada de toasts quando várias ops falham em sequência. */
export function toastCollabError(addToast, message) {
  const now = Date.now();
  if (now - lastCollabToastAt < TOAST_DEBOUNCE_MS) return;
  lastCollabToastAt = now;
  addToast(message, 'error');
}
