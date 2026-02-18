const STORAGE_KEYS = {
  USER: 'dailyways_user',
  BOARDS: 'dailyways_boards',
  SETTINGS: 'dailyways_settings',
};

const storageService = {
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  },

  load(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage load error:', e);
      return null;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  },
};

export { STORAGE_KEYS };
export default storageService;
