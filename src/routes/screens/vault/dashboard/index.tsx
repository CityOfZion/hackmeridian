import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { ScreenLayout } from '@/layouts/screen-layout';
import { WalletHome } from '@/routes/screens/wallet/home';
import { WalletCards } from '@/routes/screens/wallet/cards';
import { WalletSettings } from '@/routes/screens/wallet/settings';
import { WalletActivity } from '@/routes/screens/wallet/activity';
import { cn } from '@/utils/cn';

const tabs = ['Home', 'Activity', 'Cards', 'Settings'] as const;
export function VaultDashboardScreen() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Home');
  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>VaultPass · Personal wallet</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>
            {tab === 'Home' ? 'Your wallet' : tab === 'Cards' ? 'Your cards' : tab}
          </ScreenLayout.Title>
        </ScreenLayout.Heading>
        <AppText className="pb-1 text-xs text-brass">MAINNET</AppText>
      </ScreenLayout.Header>
      <ScreenLayout.Body key={tab}>
        {tab === 'Home' ? (
          <WalletHome />
        ) : tab === 'Cards' ? (
          <WalletCards />
        ) : tab === 'Activity' ? (
          <WalletActivity />
        ) : (
          <WalletSettings />
        )}
      </ScreenLayout.Body>
      <View
        accessibilityRole="tablist"
        className="flex-row border-t border-[#303033] bg-[#121214] px-3 pt-2 pb-safe-offset-2"
      >
        {tabs.map((name) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === name }}
            key={name}
            onPress={() => setTab(name)}
            className={cn('min-h-14 flex-1 items-center justify-center rounded-2xl', name === tab && 'bg-[#292613]')}
          >
            <AppText className={cn('font-outfit-medium text-sm', name === tab ? 'text-brass' : 'text-muted')}>
              {name}
            </AppText>
          </Pressable>
        ))}
      </View>
    </ScreenLayout>
  );
}
