/** Ative no console: localStorage.setItem('dailyways_collab_debug','1') */
export function collabDebugLog(message, data) {
  try {
    if (localStorage.getItem('dailyways_collab_debug') !== '1') return;
    console.info('[collab-debug]', message, data ?? '');
  } catch {
    /* ignore */
  }
}
