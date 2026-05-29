import { FILE_LIMITS } from './fileLimits.js';
import { LIMIT_ERROR } from './errorCodes.js';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']);

export function isImageFile(file) {
  const type = (file?.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const ext = file?.name?.split('.').pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

function mimeMatches(file, spec) {
  const type = (file?.type || '').toLowerCase();

  if (spec.mimeExact?.length) {
    if (type && spec.mimeExact.some((m) => type === m)) return true;
    return !type && isImageFile(file) && spec.mimeExact.some((m) => m.startsWith('image/'));
  }

  if (!spec.mimePrefixes?.length) return true;

  if (!type) {
    return spec.mimePrefixes.some((p) => p.startsWith('image')) && isImageFile(file);
  }

  return spec.mimePrefixes.some((p) => {
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1));
    if (p.endsWith('/')) return type.startsWith(p);
    return type === p || type.startsWith(`${p}/`);
  });
}

/**
 * @param {File|Blob} file
 * @param {keyof typeof FILE_LIMITS} specKey
 * @returns {{ ok: true } | { ok: false, code: string, specKey?: string }}
 */
export function validateFile(file, specKey) {
  const spec = FILE_LIMITS[specKey];
  if (!spec) return { ok: false, code: LIMIT_ERROR.INVALID_CONFIG };
  if (!file) return { ok: false, code: LIMIT_ERROR.INVALID_FILE };
  const size = file.size ?? 0;
  if (size > spec.maxBytes) {
    return { ok: false, code: LIMIT_ERROR.FILE_TOO_LARGE, specKey };
  }
  if (!mimeMatches(file, spec)) {
    return { ok: false, code: LIMIT_ERROR.FILE_TYPE_NOT_ALLOWED, specKey };
  }
  return { ok: true };
}
