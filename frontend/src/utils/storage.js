const STORAGE_KEYS = {
  ACCESS_TOKEN: 'aurah_access_token',
  REFRESH_TOKEN: 'aurah_refresh_token',
  USER: 'aurah_user',
};

export const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore quota / private mode */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  clearAuth() {
    this.remove(STORAGE_KEYS.ACCESS_TOKEN);
    this.remove(STORAGE_KEYS.REFRESH_TOKEN);
    this.remove(STORAGE_KEYS.USER);
  },
};

export { STORAGE_KEYS };
