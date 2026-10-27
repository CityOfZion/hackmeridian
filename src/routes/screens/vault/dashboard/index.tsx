import { useNavigation } from '@react-navigation/native';
import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useRequiredChipId } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage } from '@/store/api/cards-api';
import { useGetVaultQuery } from '@/store/api/vault-api';
import { colors } from '@/theme/colors';
import { greeting, shortNfiUid } from '@/utils/format';

import { VaultAccount } from './-vault-account';

/** Mainnet smart-account overview. Card spending requires a separate Soroban authorization flow. */
export function VaultDashboardScreen() {
  const { t } = useTranslation(['screens', 'common']);
  const navigation = useNavigation();
  const chipId = useRequiredChipId();
  const vault = useGetVaultQuery(chipId ?? skipToken);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!chipId) return null;

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
              try {
                await vault.refetch();
              } finally {
                setIsRefreshing(false);
              }
            }}
          />
        }
      >
        <VaultAccount
          account={vault.data}
          isLoading={vault.isLoading}
          error={vault.error && apiErrorMessage(vault.error)}
        />
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
