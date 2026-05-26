import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDevConfigStore } from './devConfigStore.js';
import {
  isDevUser,
  isPrimaryDevUser,
  isBoardPrankFeatureEnabled,
} from './devAccess.js';

export function useDevAccess() {
  const { user, profile } = useAuth();
  const config = useDevConfigStore((s) => s.config);
  const loaded = useDevConfigStore((s) => s.loaded);

  return useMemo(() => {
    const primary = isPrimaryDevUser(user, profile);
    const dev = isDevUser(user, profile, config);
    return {
      config,
      loaded,
      isPrimaryDev: primary,
      isDevUser: dev,
      canOpenDevMenu: dev,
      canEditDevConfig: primary,
      isPrankEnabled: isBoardPrankFeatureEnabled(user, profile, config),
    };
  }, [user, profile, config, loaded]);
}
