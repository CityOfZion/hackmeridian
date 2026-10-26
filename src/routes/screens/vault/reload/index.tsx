import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ASSET_CODE, MAX_RELOAD } from '@/constants';
import { useRequiredSession } from '@/hooks/use-session';
import { ScreenLayout } from '@/layouts/screen-layout';

import { applyKey, Keypad } from './-keypad';

/** Reload: buy EURC with Mercuryo and deposit it into the vault. */
export function VaultReloadScreen() {
  const navigation = useNavigation();
  const session = useRequiredSession();
  const [amount, setAmount] = useState('');
  const value = Number(amount);
  const overMax = value > MAX_RELOAD;

  if (!session) return null;

  return (
    <ScreenLayout>
      <ScreenLayout.Header>
        <ScreenLayout.Heading>
          <ScreenLayout.Eyebrow>BUY WITH MERCURYO</ScreenLayout.Eyebrow>
          <ScreenLayout.Title>Reload vault</ScreenLayout.Title>
        </ScreenLayout.Heading>
        <ScreenLayout.BackButton />
      </ScreenLayout.Header>
      <ScreenLayout.Body>
        <View className="mb-5.5 items-center rounded-lg bg-brass pt-8.75 pb-7">
          <AppText className="text-2xs tracking-widest text-[#2d2a0b]">RELOAD AMOUNT</AppText>
          <AppText className="mt-3 font-outfit-semibold text-5xl leading-none tracking-tighter text-[#111]">
            {amount || '0.00'} <AppText className="text-lg text-[#2d2a0b]">{ASSET_CODE}</AppText>
          </AppText>
          <AppText className="mt-3 text-2xs text-[#2d2a0b]">
            {overMax ? `Maximum ${MAX_RELOAD} ${ASSET_CODE} per reload` : 'Paid in EUR, settled as EURC on Stellar'}
          </AppText>
        </View>
        <Keypad onKeyPress={(key) => setAmount((current) => applyKey(current, key))} />
      </ScreenLayout.Body>
      <ScreenLayout.Footer>
        <Button
          icon="tap"
          label="Continue"
          disabled={!value || overMax}
          onPress={() => navigation.navigate('(screens)/vault/confirm', { action: 'reload', amount: value })}
        />
      </ScreenLayout.Footer>
    </ScreenLayout>
  );
}
