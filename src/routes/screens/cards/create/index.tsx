import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CardDesign } from '@/api/types';
import { CardDesignPicker } from '@/components/card/card-design-picker';
import { PhysicalCard } from '@/components/card/physical-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { InfoRows } from '@/components/ui/info-rows';
import { CARD_LABEL_MAX_LENGTH } from '@/constants';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useCreateCardMutation } from '@/store/api/cards-api';

/** New bunq virtual card linked to the signed-in Pass. It starts empty; funding raises its limit from the vault. */
export function CardsCreateScreen() {
  const { t } = useTranslation('screens');
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const [createCard, { isLoading }] = useCreateCardMutation();
  const [label, setLabel] = useState('');
  const [design, setDesign] = useState<CardDesign>('a');
  const [error, setError] = useState<string>();
  const trimmedLabel = label.trim();

  if (!chipId) return null;

  const create = async () => {
    setError(undefined);
    try {
      await createCard({ label: trimmedLabel, design }).unwrap();
      navigation.goBack();
    } catch (createError) {
      setError(apiErrorMessage(createError));
    }
  };

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{t('cards.create.eyebrow')}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{t('cards.create.title')}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <PhysicalCard design={design} holderName={trimmedLabel || undefined} />
        <View className="mt-6 gap-6">
          <FormField
            label={t('cards.create.nameLabel')}
            value={label}
            onChangeText={setLabel}
            placeholder={t('cards.create.namePlaceholder')}
            autoCapitalize="words"
            maxLength={CARD_LABEL_MAX_LENGTH}
            returnKeyType="done"
          />
          <CardDesignPicker label={t('cards.create.faceLabel')} value={design} onChange={setDesign} />
        </View>
        <InfoRows
          rows={[
            { label: t('cards.create.issuer'), value: t('cards.create.issuerValue') },
            { label: t('cards.create.payWith'), value: t('cards.create.payWithValue') },
            { label: t('cards.create.linkedTo'), value: t('cards.create.linkedToValue') },
          ]}
        />
        {error && <AppText className="mb-4 text-sm text-danger">{error}</AppText>}
        {/* CTA stays in the body (the keyboard would cover a pinned footer), so it clears the bottom inset itself */}
        <View className="pb-safe">
          <Button
            icon="plus"
            label={isLoading ? t('cards.create.creating') : t('cards.create.create')}
            disabled={!trimmedLabel || isLoading}
            onPress={create}
          />
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
