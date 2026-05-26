import { useEffect } from 'react';
import { heartbeatPresence } from '../services/chatService';

export function usePresenceHeartbeat(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => { heartbeatPresence().catch(() => {}); };
    tick();
    const id = setInterval(tick, 25000);
    return () => clearInterval(id);
  }, [enabled]);
}
