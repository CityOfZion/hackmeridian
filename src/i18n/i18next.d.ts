import 'i18next';

import type { defaultNS, resources } from '.';

// Typed keys: t('vault.fund.title') is checked against locales/en/*.json
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
