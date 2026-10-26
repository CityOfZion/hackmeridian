import { useNavigation } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { SectionTitle } from '@/components/ui/section-title';
import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, useGetCardsQuery } from '@/store/api/cards-api';
import { useAppSelector } from '@/store/hooks';
import { selectVaultBalance } from '@/store/slices/vault-slice';
import { colors } from '@/theme/colors';
import { greeting, shortNfiUid } from '@/utils/format';

import { CardStack } from './-card-stack';

export function VaultDashboardScreen() {
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const balance = useAppSelector(selectVaultBalance);
  const cards = useGetCardsQuery(chipId ? undefined : skipToken);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>();

  if (!chipId) return null;

  // Reloads go to the selected card; the first one until the user picks another
  const selectedCard = cards.data?.find((card) => card.id === selectedCardId) ?? cards.data?.[0];

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>{`PASS · ${shortNfiUid(chipId)}`}</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>{greeting()}</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton
          icon="logout"
          accessibilityLabel="Sign out"
          onPress={() => navigation.navigate('(drawers)/session/sign-out')}
        />
      </ScreenLayout.Header>
      <ScreenLayout.Body
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.brass}
            onRefresh={async () => {
              setIsRefreshing(true);
              await cards.refetch();
              setIsRefreshing(false);
            }}
          />
        }
      >
        <View className="items-center pb-2">
          <AppText className="text-2xs tracking-widest text-muted">VAULT BALANCE</AppText>
          <Money amount={balance} size="2xl" className="mt-1.25 font-outfit-semibold" />
        </View>

        {/* One Pass funds many bunq virtual cards */}
        <SectionTitle
          title="Cards"
          action="New card"
          onActionPress={() => navigation.navigate('(screens)/cards/create')}
        />
        {cards.isLoading && (
          <View className="mt-4 items-center gap-2">
            <ActivityIndicator color={colors.brass} />
            {/* The first connection generates an RSA key and registers this device with bunq */}
            <AppText className="text-2xs text-muted">Connecting to bunq…</AppText>
          </View>
        )}
        {cards.error && <AppText className="text-sm text-danger">{apiErrorMessage(cards.error)}</AppText>}
        {cards.data?.length === 0 && (
          <AppText className="text-sm text-muted">No bunq cards yet. Create one to pay with Google Pay.</AppText>
        )}
        {cards.data && selectedCard && (
          <CardStack cards={cards.data} selectedId={selectedCard.id} onSelect={setSelectedCardId} />
        )}
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="down"
          label={selectedCard ? `Reload ${selectedCard.label}` : 'Reload'}
          disabled={!selectedCard || balance <= 0}
          onPress={() => selectedCard && navigation.navigate('(screens)/vault/reload', { cardId: selectedCard.id })}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
