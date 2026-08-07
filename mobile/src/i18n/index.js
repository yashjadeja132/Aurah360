import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'hi', label: 'हिन्दी' },
];

const STORAGE_KEY = 'aurah360.patient.language';

export async function initI18n() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, gu: { translation: gu }, hi: { translation: hi } },
    lng: saved || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export async function setLanguage(code) {
  await AsyncStorage.setItem(STORAGE_KEY, code);
  await i18next.changeLanguage(code);
}

export default i18next;
