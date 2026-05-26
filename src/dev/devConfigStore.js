import { create } from 'zustand';
import { DEFAULT_DEV_CONFIG } from './devAccess.js';

export const useDevConfigStore = create((set, get) => ({
  config: { ...DEFAULT_DEV_CONFIG },
  loaded: false,
  saving: false,
  error: null,

  setConfig(config) {
    set({
      config: { ...DEFAULT_DEV_CONFIG, ...config },
      loaded: true,
      error: null,
    });
  },

  setSaving(saving) {
    set({ saving });
  },

  setError(error) {
    set({ error: error || null });
  },

  getConfig() {
    return get().config;
  },
}));
