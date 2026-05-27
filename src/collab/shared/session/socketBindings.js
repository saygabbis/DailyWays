export function bindSocketHandlers(socket, bindings) {
  const normalized = (bindings || []).filter(
    ([event, handler]) => typeof event === 'string' && typeof handler === 'function',
  );
  for (const [event, handler] of normalized) {
    socket.on(event, handler);
  }
  return normalized;
}

export function unbindSocketHandlers(socket, bindings) {
  if (!socket || !Array.isArray(bindings)) return;
  for (const [event, handler] of bindings) {
    socket.off(event, handler);
  }
}
