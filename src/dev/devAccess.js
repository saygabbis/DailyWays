/**
 * Contas DEV — owner: gaffonsoxx@gmail.com / @gabbis
 */
export const PRIMARY_DEV_EMAIL = 'gaffonsoxx@gmail.com';
export const PRIMARY_DEV_USERNAME = 'gabbis';

export const DEFAULT_DEV_CONFIG = {
  prankEnabled: true,
  additionalDevs: [],
};

/** @typedef {{ kind: 'email'|'username', value: string, label: string }} DevAccountEntry */

export function normalizeDevInput(raw) {
  const t = (raw || '').trim();
  if (!t) return null;
  if (t.startsWith('@')) {
    const value = t.slice(1).toLowerCase();
    if (!value) return null;
    return { kind: 'username', value, label: `@${value}` };
  }
  if (t.includes('@')) {
    const value = t.toLowerCase();
    return { kind: 'email', value, label: value };
  }
  const value = t.toLowerCase();
  return { kind: 'username', value, label: `@${value}` };
}

function normUsername(username) {
  return (username || '').toLowerCase().replace(/^@/, '');
}

function normEmail(email) {
  return (email || '').toLowerCase();
}

/**
 * @param {{ email?: string, username?: string } | null} user
 * @param {{ username?: string } | null} profile
 */
export function isPrimaryDevUser(user, profile) {
  if (!user) return false;
  const email = normEmail(user.email);
  const username = normUsername(profile?.username ?? user.username);
  return email === PRIMARY_DEV_EMAIL || username === PRIMARY_DEV_USERNAME;
}

/**
 * @param {{ email?: string, username?: string } | null} user
 * @param {{ username?: string } | null} profile
 * @param {typeof DEFAULT_DEV_CONFIG} [config]
 */
export function isDevUser(user, profile, config = DEFAULT_DEV_CONFIG) {
  if (!user) return false;
  if (isPrimaryDevUser(user, profile)) return true;

  const email = normEmail(user.email);
  const username = normUsername(profile?.username ?? user.username);
  const extras = config?.additionalDevs || [];

  for (const entry of extras) {
    if (!entry?.value) continue;
    if (entry.kind === 'userId' && user?.id === entry.value) return true;
    if (entry.kind === 'email' && email === entry.value) return true;
    if (entry.kind === 'username' && username === entry.value) return true;
  }
  return false;
}

/**
 * @param {{ email?: string, username?: string } | null} user
 * @param {{ username?: string } | null} profile
 * @param {typeof DEFAULT_DEV_CONFIG} config
 */
export function isBoardPrankFeatureEnabled(user, profile, config) {
  if (!config?.prankEnabled) return false;
  return isDevUser(user, profile, config);
}

export function devEntryKey(entry) {
  return `${entry.kind}:${entry.value}`;
}

export function isDuplicateDevEntry(list, entry) {
  const key = devEntryKey(entry);
  return (list || []).some((e) => devEntryKey(e) === key);
}

/** Impede adicionar o owner como extra. */
export function isReservedDevEntry(entry) {
  if (!entry) return true;
  if (entry.kind === 'email' && entry.value === PRIMARY_DEV_EMAIL) return true;
  if (entry.kind === 'username' && entry.value === PRIMARY_DEV_USERNAME) return true;
  return false;
}
