import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es.json';
import en from './en.json';

export type Language = 'es' | 'en';

export function detectLanguage(saved: Language | null, browserLanguages: readonly string[]): Language {
  if (saved) return saved;
  return browserLanguages[0]?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export async function initI18n(language: Language): Promise<void> {
  if (i18n.isInitialized) {
    await i18n.changeLanguage(language);
  } else {
    await i18n.use(initReactI18next).init({
      resources: { es: { translation: es }, en: { translation: en } },
      lng: language,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  }
  document.documentElement.lang = language;
}

export { i18n };
