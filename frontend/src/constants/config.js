export const APP_CONFIG = Object.freeze({
  name: import.meta.env.VITE_APP_NAME || 'Aurah 360 ClinicOS',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  apiOrigin: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(
    /\/api\/v1\/?$/,
    ''
  ),
  env: import.meta.env.VITE_APP_ENV || 'development',
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE || 'en',
  defaultTimezone: import.meta.env.VITE_DEFAULT_TIMEZONE || 'Asia/Kolkata',
});

export default APP_CONFIG;
