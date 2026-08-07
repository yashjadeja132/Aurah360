export const PATIENT_STORAGE_KEYS = Object.freeze({
  ACCESS_TOKEN: 'aurah_patient_access_token',
  REFRESH_TOKEN: 'aurah_patient_refresh_token',
  PATIENT: 'aurah_patient',
});

export const patientStorage = {
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
      /* ignore */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  clear() {
    this.remove(PATIENT_STORAGE_KEYS.ACCESS_TOKEN);
    this.remove(PATIENT_STORAGE_KEYS.REFRESH_TOKEN);
    this.remove(PATIENT_STORAGE_KEYS.PATIENT);
  },
};
