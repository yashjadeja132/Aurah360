import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';

/**
 * NFR-014/APP-007 — English/Gujarati/Hindi. Coverage today is the shell every screen shares
 * (navigation, auth, common actions, dashboard) — most feature-page copy is still hard-coded
 * English pending a full translation pass.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'hi', label: 'हिन्दी' },
];

const STORAGE_KEY = 'aurah360.language';

i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, gu: { translation: gu }, hi: { translation: hi } },
  lng: localStorage.getItem(STORAGE_KEY) || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(code) {
  localStorage.setItem(STORAGE_KEY, code);
  i18next.changeLanguage(code);
}

export default i18next;
