import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ResultBadge } from '@/components/ui/result-badge';
import { getLanguagePreference, LANGUAGES, type LanguagePreference, setLanguagePreference } from '@/i18n';
import { SheetLayout } from '@/layouts/sheet-layout';

const OPTIONS: LanguagePreference[] = ['system', ...LANGUAGES];

/** Language picker: follow the phone, or force one of the bundled languages. Applies at once and is remembered. */
export function SettingsLanguageDrawer() {
  const navigation = useNavigation();
  const { t } = useTranslation(['drawers', 'common']);
  const [current] = useState(getLanguagePreference);

  const choose = (preference: LanguagePreference) => {
    setLanguagePreference(preference);
    navigation.goBack();
  };

  return (
    <SheetLayout
      badge={<ResultBadge icon="globe" tone="brass" round />}
      eyebrow={t('settings.language.eyebrow')}
      title={t('settings.language.title')}
      body={t('settings.language.body')}
    >
      {OPTIONS.map((option) => (
        <Button
          key={option}
          variant={option === current ? 'primary' : 'secondary'}
          icon={option === current ? 'check' : undefined}
          // Language names stay in their own language, so they read right whatever is selected
          label={option === 'system' ? t('common:language.system') : t(`common:language.names.${option}`)}
          onPress={() => choose(option)}
        />
      ))}
    </SheetLayout>
  );
}
