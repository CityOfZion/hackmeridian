import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Animated, View } from 'react-native';
import { withUniwind } from 'uniwind';

import type { TapResult } from '@/api/types';
import { cardAssets } from '@/components/card/assets';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DEV_CHIP_IDS } from '@/constants';
import { BiometricError, useBiometricConfirm } from '@/hooks/use-biometric-confirm';
import { usePassTap } from '@/hooks/use-pass-tap';
import { ScreenLayout } from '@/layouts/screen-layout';
import { apiErrorMessage, usePasskeyVerifyMutation } from '@/store/api/vault-api';
import { useAppDispatch } from '@/store/hooks';
import { sessionStarted } from '@/store/slices/session-slice';

import { useTitleEntrance } from './-use-title-entrance';

const StyledImage = withUniwind(Image);

/** Sign-in: tap the Pass, then Face ID. A Pass the backend has never seen goes to registration instead. */
export function ScanScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const dispatch = useAppDispatch();
  const { vaultStyle, passStyle } = useTitleEntrance();
  const { tapPass, simulateTap, isTapping, error, setError, isNfiScanAvailable } = usePassTap();
  const { confirmWithBiometrics } = useBiometricConfirm();
  const [passkeyVerify, { isLoading: isVerifying }] = usePasskeyVerifyMutation();
  const [isConfirming, setIsConfirming] = useState(false);
  const busy = isTapping || isConfirming || isVerifying;

  const signIn = async (tap: TapResult | null) => {
    if (!tap) return;
    if (!tap.registered) {
      navigation.navigate('(screens)/register', { chipId: tap.chipId, tapToken: tap.tapToken });
      return;
    }

    setIsConfirming(true);
    try {
      if (!(await confirmWithBiometrics('Sign in to Vault Pass'))) return;
      const session = await passkeyVerify({ tapToken: tap.tapToken, chipId: tap.chipId }).unwrap();
      dispatch(sessionStarted(session));
      navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
    } catch (signInError) {
      setError(signInError instanceof BiometricError ? signInError.message : apiErrorMessage(signInError));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <ScreenLayout className="bg-brass pt-safe pb-safe">
      {/* No Header on this screen, so the root takes the safe-area insets. */}
      <ScreenLayout.Body contentContainerClassName="grow pt-11.5 pb-6">
        {isFocused && <StatusBar style="dark" />}

        <View>
          <StyledImage
            source={cardAssets.logoWhite.source}
            tintColor="#111"
            contentFit="contain"
            className="mb-6 h-7.25 w-29.25"
            accessibilityLabel="Stellar"
          />
          <AppText className="font-outfit-semibold text-2xs tracking-widest text-[#111]">ITEM SYSTEMS · NFI v3</AppText>
          <View
            className="mt-4.5 flex-row overflow-hidden"
            accessible
            accessibilityRole="header"
            accessibilityLabel="VaultPass"
          >
            <Animated.Text style={vaultStyle} className="font-outfit-semibold text-6xl leading-none text-[#111]">
              Vault
            </Animated.Text>
            <Animated.Text style={passStyle} className="font-outfit-semibold text-6xl leading-none text-[#111]">
              Pass
            </Animated.Text>
          </View>
          <AppText className="mt-4.5 max-w-70 text-lg leading-tight text-[#111]">
            Your EURC vault on Stellar.{'\n'}Tap your Pass to sign in.
          </AppText>
        </View>

        <View className="mt-auto gap-3 border-t border-[#111] pt-5">
          {error && <AppText className="text-sm text-[#7a1d1d]">{error}</AppText>}
          {isNfiScanAvailable === false && __DEV__ ? (
            // No NFC reader (iOS simulator, emulators): keep the flow testable without a Pass.
            <>
              <Button
                variant="inverse"
                icon="tap"
                label="Simulate tap"
                disabled={busy}
                onPress={async () => signIn(await simulateTap(DEV_CHIP_IDS.registered))}
              />
              <Button
                variant="inverse"
                label="Simulate new Pass"
                disabled={busy}
                onPress={async () => signIn(await simulateTap(DEV_CHIP_IDS.unregistered))}
              />
            </>
          ) : (
            <Button
              variant="inverse"
              icon="tap"
              label={busy ? 'Reading Pass…' : 'Tap your Pass'}
              disabled={busy || !isNfiScanAvailable}
              onPress={async () => signIn(await tapPass('Hold your Pass near the top of the phone'))}
            />
          )}
          <View className="flex-row items-center gap-2">
            <View className="size-1.5 rounded-full bg-success" />
            <AppText className="text-2xs leading-relaxed text-[#2e2c18]">
              Keys stay on the chip. Face ID confirms it is you.
            </AppText>
          </View>
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
