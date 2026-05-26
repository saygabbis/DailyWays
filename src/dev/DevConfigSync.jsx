import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchDevToolConfig } from './devConfigService.js';
import { useDevConfigStore } from './devConfigStore.js';
import { DEFAULT_DEV_CONFIG } from './devAccess.js';

/** Carrega config DEV do Supabase após login. */
export default function DevConfigSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      useDevConfigStore.getState().setConfig({ ...DEFAULT_DEV_CONFIG });
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const config = await fetchDevToolConfig();
      if (!cancelled) useDevConfigStore.getState().setConfig(config);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return null;
}
