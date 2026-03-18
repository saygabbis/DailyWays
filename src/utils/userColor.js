const PRESENCE_COLOR_PALETTE = [
  '#7c3aed', // purple
  '#2563eb', // blue
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#22c55e', // green
  '#3b82f6', // sky
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // red
];

function hashStringToInt(input) {
  // Deterministic hash (no crypto) for stable presence colors.
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function colorFromUserId(userId) {
  const safe = String(userId || '');
  if (!safe) return '#7c3aed';
  const idx = hashStringToInt(safe) % PRESENCE_COLOR_PALETTE.length;
  return PRESENCE_COLOR_PALETTE[idx];
}

export function initialFromName(name) {
  const s = (name || '').trim();
  if (!s) return '?';
  return s[0].toUpperCase();
}

