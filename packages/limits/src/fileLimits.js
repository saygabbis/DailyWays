/**
 * Limites de upload (tamanho em MB).
 * Altere apenas estes números para mudar o comportamento em toda a app.
 */
export const FILE_LIMIT_MB = {
  chatImage: 10,
  cardAttachment: 100,
  whiteboardImage: 50,
  whiteboardFile: 100,
  avatar: 2,
};

const mb = (n) => n * 1024 * 1024;

/**
 * Tipos "ativos" (o navegador executa ao abrir o arquivo): nunca como anexo livre. Um HTML enviado
 * como arquivo do Space abria como página no domínio do storage.
 */
export const BLOCKED_FILE_MIME = ['text/html', 'application/xhtml+xml', 'text/javascript', 'application/javascript', 'application/x-msdownload'];
export const BLOCKED_FILE_EXTENSIONS = ['html', 'htm', 'xhtml', 'js', 'mjs', 'exe', 'bat', 'cmd', 'msi', 'ps1', 'vbs', 'scr'];

/** Especificações derivadas — use estas keys nos validadores. */
export const FILE_LIMITS = {
  chatImage: {
    key: 'chatImage',
    maxBytes: mb(FILE_LIMIT_MB.chatImage),
    mimePrefixes: ['image/*'],
  },
  cardAttachment: {
    key: 'cardAttachment',
    maxBytes: mb(FILE_LIMIT_MB.cardAttachment),
    mimePrefixes: null,
  },
  whiteboardImage: {
    key: 'whiteboardImage',
    maxBytes: mb(FILE_LIMIT_MB.whiteboardImage),
    mimePrefixes: ['image/*'],
  },
  whiteboardFile: {
    key: 'whiteboardFile',
    maxBytes: mb(FILE_LIMIT_MB.whiteboardFile),
    mimePrefixes: null,
  },
  avatar: {
    key: 'avatar',
    maxBytes: mb(FILE_LIMIT_MB.avatar),
    mimePrefixes: ['image/jpeg', 'image/png', 'image/webp'],
    mimeExact: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

export function formatMaxFileSize(specKey) {
  const mbVal = FILE_LIMIT_MB[specKey];
  if (mbVal == null) return '';
  return mbVal >= 1 ? `${mbVal} MB` : `${Math.round(mbVal * 1024)} KB`;
}
