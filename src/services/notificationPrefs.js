const PREFS_KEY = 'dailyways_notification_prefs_v1';

const DEFAULT_PREFS = {
  pushEnabled: true,
  soundEnabled: true,
};

export function getNotificationPrefs() {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      pushEnabled: parsed?.pushEnabled !== false,
      soundEnabled: parsed?.soundEnabled !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setNotificationPrefs(nextPartial) {
  if (typeof window === 'undefined') return;
  const next = {
    ...getNotificationPrefs(),
    ...(nextPartial || {}),
  };
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('notification-prefs-updated', { detail: next }));
}

