import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

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

/** New bunq virtual card linked to the signed-in Pass. It starts empty; reloads fund the vault it spends from. */
export function CardsCreateScreen() {
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
          <ScreenLayout.Eyebrow>VIRTUAL CARD</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>New card</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <PhysicalCard design={design} holderName={trimmedLabel || undefined} />
        <View className="mt-6 gap-6">
          <FormField
            label="CARD NAME"
            value={label}
            onChangeText={setLabel}
            placeholder="Groceries"
            autoCapitalize="words"
            maxLength={CARD_LABEL_MAX_LENGTH}
            returnKeyType="done"
          />
          <CardDesignPicker label="CARD FACE" value={design} onChange={setDesign} />
        </View>
        <InfoRows
          rows={[
            { label: 'ISSUER', value: 'BUNQ · MASTERCARD' },
            { label: 'PAY WITH', value: 'GOOGLE PAY' },
            { label: 'LINKED TO', value: 'YOUR PASS' },
          ]}
        />
        {error && <AppText className="mb-4 text-sm text-danger">{error}</AppText>}
        {/* CTA stays in the body (the keyboard would cover a pinned footer), so it clears the bottom inset itself */}
        <View className="pb-safe">
          <Button
            icon="plus"
            label={isLoading ? 'Creating card…' : 'Create card'}
            disabled={!trimmedLabel || isLoading}
            onPress={create}
          />
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
