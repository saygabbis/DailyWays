import { colorFromUserId } from './userColor';

const photoColorCache = new Map();
const userPhotoColorCache = new Map();

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Saturate muted averages so presence rings stay vivid on UI. */
function enhanceColor(hex) {
  if (!hex || typeof hex !== 'string') return hex;
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  let r = parseInt(m[1], 16);
  let g = parseInt(m[2], 16);
  let b = parseInt(m[3], 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 40) {
    if (r >= g && r >= b) r = Math.min(255, r + 35);
    else if (g >= r && g >= b) g = Math.min(255, g + 35);
    else b = Math.min(255, b + 35);
  }
  return rgbToHex(r, g, b);
}

export function getCachedPhotoPresenceColor(userId) {
  return userPhotoColorCache.get(userId) || null;
}

export function setCachedPhotoPresenceColor(userId, color) {
  if (userId && color) userPhotoColorCache.set(userId, color);
}

/**
 * Sample dominant-ish color from profile photo (canvas average, browser-only).
 */
export function extractDominantColorFromImage(url) {
  if (!url || typeof window === 'undefined') return Promise.resolve(null);
  if (photoColorCache.has(url)) return Promise.resolve(photoColorCache.get(url));

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 40;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 140) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        if (!count) {
          resolve(null);
          return;
        }
        const color = enhanceColor(rgbToHex(r / count, g / count, b / count));
        photoColorCache.set(url, color);
        resolve(color);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function resolvePresenceColor({
  userId,
  presenceColor,
  presenceColorAuto,
  photoUrl,
}) {
  const manual = presenceColor && String(presenceColor).trim();
  if (manual && !presenceColorAuto) return manual;
  if (presenceColorAuto !== false) {
    const cached = userId ? getCachedPhotoPresenceColor(userId) : null;
    if (cached) return cached;
    if (photoUrl) return colorFromUserId(userId);
  }
  return colorFromUserId(userId);
}

export const PRESENCE_COLOR_PRESETS = [
  '#7c3aed', '#2563eb', '#ec4899', '#f97316', '#14b8a6',
  '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
];
