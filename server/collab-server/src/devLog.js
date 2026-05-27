const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function devLog(message, data = null) {
  if (IS_PRODUCTION) return;
  if (data == null) {
    console.debug(`[collab-server][dev] ${message}`);
    return;
  }
  console.debug(`[collab-server][dev] ${message}`, data);
}
