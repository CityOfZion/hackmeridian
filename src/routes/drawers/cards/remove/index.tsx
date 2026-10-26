import { useNavigation, type StaticScreenProps } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ResultBadge } from '@/components/ui/result-badge';
import { useRequiredChipId } from '@/hooks/use-session';
import { SheetLayout } from '@/layouts/sheet-layout';
import { apiErrorMessage, useGetCardsQuery, useRemoveCardMutation } from '@/store/api/cards-api';

import type { TCardsRemoveDrawerParams } from './types';

/** Removes a card: bunq cancels it for good (there is no delete). This sheet is the confirmation. */
export function CardsRemoveDrawer({ route }: StaticScreenProps<TCardsRemoveDrawerParams>) {
  const navigation = useNavigation();
  const { t } = useTranslation(['drawers', 'common']);
  const chipId = useRequiredChipId();
  const { cardId } = route.params;
  const { data: cards } = useGetCardsQuery();
  const [error, setError] = useState<string>();
  const [removeCard] = useRemoveCardMutation();
  const [isRemoving, setIsRemoving] = useState(false);

  if (!chipId) return null;

  const card = cards?.find((item) => item.id === cardId);
  const label = card ? `${card.label} · •••• ${card.last4}` : '';

  const remove = async () => {
    setError(undefined);
    setIsRemoving(true);
    try {
      await removeCard({ cardId }).unwrap();
      navigation.goBack();
    } catch (removeError) {
      setError(apiErrorMessage(removeError));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <SheetLayout
      badge={<ResultBadge icon="close" tone="danger" round />}
      eyebrow={t('cards.remove.eyebrow')}
      title={t('cards.remove.title', { label })}
      body={t('cards.remove.body')}
    >
      {error && <AppText className="text-center text-sm text-danger">{error}</AppText>}
      <Button
        label={isRemoving ? t('cards.remove.removing') : t('cards.remove.confirm')}
        disabled={isRemoving || !card}
        onPress={remove}
      />
      <Button
        variant="secondary"
        label={t('common:actions.cancel')}
        disabled={isRemoving}
        onPress={() => navigation.goBack()}
      />
    </SheetLayout>
  );
}
