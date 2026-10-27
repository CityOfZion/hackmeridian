import { useNavigation } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SectionTitle } from '@/components/ui/section-title';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useGetCardsQuery } from '@/store/api/cards-api';
import { useGetVaultQuery } from '@/store/api/vault-api';
import { colors } from '@/theme/colors';
import { greeting, shortNfiUid } from '@/utils/format';

import { CardStack } from './-card-stack';
import { VaultAccount } from './-vault-account';

export function VaultDashboardScreen() {
  const { t } = useTranslation(['screens', 'common']);
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const vault = useGetVaultQuery(chipId ?? skipToken);
  const cards = useGetCardsQuery(chipId ? undefined : skipToken);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>();

  if (!chipId) return null;

  // Funding goes to the selected card; the first one until the user picks another
  const selectedCard = cards.data?.find((card) => card.id === selectedCardId) ?? cards.data?.[0];

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{t('vault.dashboard.eyebrow', { uid: shortNfiUid(chipId) })}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{greeting()}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <View className="flex-row gap-2">
          <ScreenLayout.BackButton
            icon="globe"
            accessibilityLabel={t('common:language.label')}
            onPress={() => navigation.navigate('(drawers)/settings/language')}
          />
          <ScreenLayout.BackButton
            icon="logout"
            accessibilityLabel={t('vault.dashboard.signOut')}
            onPress={() => navigation.navigate('(drawers)/session/sign-out')}
          />
        </View>
      </ScreenLayout.Header>
      <ScreenLayout.Body
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.brass}
            onRefresh={async () => {
              setIsRefreshing(true);
              await Promise.all([cards.refetch(), vault.refetch()]);
              setIsRefreshing(false);
            }}
          />
        }
      >
        <VaultAccount
          chipId={chipId}
          account={vault.data}
          isLoading={vault.isLoading}
          error={vault.error && apiErrorMessage(vault.error)}
        />

        {/* One Pass funds many bunq virtual cards */}
        <SectionTitle
          title={t('vault.dashboard.cards')}
          action={t('vault.dashboard.newCard')}
          onActionPress={() => navigation.navigate('(screens)/cards/create')}
        />
        {cards.isLoading && (
          <View className="mt-4 items-center gap-2">
            <ActivityIndicator color={colors.brass} />
            {/* The first connection generates an RSA key and registers this device with bunq */}
            <AppText className="text-2xs text-muted">{t('vault.dashboard.connecting')}</AppText>
          </View>
        )}
        {cards.error && <AppText className="text-sm text-danger">{apiErrorMessage(cards.error)}</AppText>}
        {cards.data?.length === 0 && <AppText className="text-sm text-muted">{t('vault.dashboard.noCards')}</AppText>}
        {cards.data && selectedCard && (
          <>
            <CardStack cards={cards.data} selectedId={selectedCard.id} onSelect={setSelectedCardId} />
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('(drawers)/cards/remove', { cardId: selectedCard.id })}
              className="mt-4 flex-row items-center gap-1.5 self-center px-3 py-2 active:opacity-60"
            >
              <Icon name="close" size={16} color={colors.danger} />
              <AppText className="text-xs text-danger">
                {t('vault.dashboard.removeCard', { label: selectedCard.label })}
              </AppText>
            </Pressable>
          </>
        )}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="down"
          label={
            selectedCard ? t('vault.dashboard.fundCard', { label: selectedCard.label }) : t('vault.dashboard.fund')
          }
          disabled={!selectedCard || !Object.values(vault.data?.balances ?? {}).some((balance) => (balance ?? 0) > 0)}
          onPress={() => selectedCard && navigation.navigate('(screens)/vault/fund', { cardId: selectedCard.id })}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
