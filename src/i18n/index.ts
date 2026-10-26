import { getLocales } from 'expo-localization';
import { getItem, setItem } from 'expo-secure-store';
import { createInstance } from 'i18next';
import { AppState } from 'react-native';
import { initReactI18next } from 'react-i18next';

import common from './locales/en/common.json';
import drawers from './locales/en/drawers.json';
import screens from './locales/en/screens.json';
import ptCommon from './locales/pt-PT/common.json';
import ptDrawers from './locales/pt-PT/drawers.json';
import ptScreens from './locales/pt-PT/screens.json';

/**
 * Namespaces: `common` (shared UI, tap flow, errors), `screens` (keyed by route path: `vault.fund.title` for
 * '(screens)/vault/fund'), `drawers` (same, for '(drawers)/…'). Languages: English and European Portuguese; add one by
 * adding `locales/<lng>/*.json` with the same keys and its entry below.
 */
export const resources = {
  en: { common, screens, drawers },
  'pt-PT': { common: ptCommon, screens: ptScreens, drawers: ptDrawers },
} as const;
export const defaultNS = 'common';

export type Language = keyof typeof resources;
export const LANGUAGES = Object.keys(resources) as Language[];
/** `system` follows the phone (or the per-app language set in the phone's settings). */
export type LanguagePreference = Language | 'system';

const PREFERENCE_KEY = 'app.language';

/** Any Portuguese device locale (pt-PT, pt-BR, …) gets pt-PT; everything else English. */
function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === 'pt' ? 'pt-PT' : 'en';
}

/** The language chosen in the app, read synchronously so the first render already uses it. */
export function getLanguagePreference(): LanguagePreference {
  const stored = getItem(PREFERENCE_KEY);
  return stored && (LANGUAGES as string[]).includes(stored) ? (stored as Language) : 'system';
}

const resolveLanguage = (preference: LanguagePreference) => (preference === 'system' ? deviceLanguage() : preference);

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(getLanguagePreference()),
  fallbackLng: 'en',
  ns: ['common', 'screens', 'drawers'],
  defaultNS,
  // Resources are bundled, so init synchronously: the first render already has translations
  initAsync: false,
  // React escapes already
  interpolation: { escapeValue: false },
});

/** Saves the choice and switches every mounted `t` at once. */
export function setLanguagePreference(preference: LanguagePreference) {
  setItem(PREFERENCE_KEY, preference);
  i18n.changeLanguage(resolveLanguage(preference));
}

// Following the phone: pick up a language changed in settings when the app comes back to the foreground
AppState.addEventListener('change', (state) => {
  if (state !== 'active' || getLanguagePreference() !== 'system') return;
  const language = deviceLanguage();
  if (language !== i18n.language) i18n.changeLanguage(language);
});

export default i18n;
