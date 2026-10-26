import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Animated, TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { cardAssets } from '@/components/card/assets';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DEV_CHIP_ID } from '@/constants';
import { BiometricError, useBiometricConfirm } from '@/hooks/use-biometric-confirm';
import { usePassTap } from '@/hooks/use-pass-tap';
import { ScreenLayout } from '@/layouts/screen-layout';
import { useAppDispatch } from '@/store/hooks';
import { sessionStarted } from '@/store/slices/session-slice';

import { useTitleEntrance } from './-use-title-entrance';

const StyledImage = withUniwind(Image);

/** Sign-in: verify a fresh Pass signature, then confirm with local biometrics. */
export function ScanScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const dispatch = useAppDispatch();
  const { vaultStyle, passStyle } = useTitleEntrance();
  const { tapPass, simulateTap, isTapping, error, setError } = usePassTap();
  const { confirmWithBiometrics } = useBiometricConfirm();
  const [isConfirming, setIsConfirming] = useState(false);
  const [pairingKey, setPairingKey] = useState('');
  const busy = isTapping || isConfirming;

  const open = async (chipId: string | null) => {
    if (!chipId) return;
    setIsConfirming(true);
    try {
      if (!(await confirmWithBiometrics('Sign in to Vault Pass'))) return;
      dispatch(sessionStarted(chipId));
      navigation.reset({ index: 0, routes: [{ name: '(screens)/vault/dashboard' }] });
    } catch (biometricError) {
      setError(biometricError instanceof BiometricError ? biometricError.message : 'Could not confirm it is you.');
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
            Your cards on Stellar.{'\n'}Tap your Pass to open them.
          </AppText>
        </View>

        <View className="mt-auto gap-3 border-t border-[#111] pt-5">
          {error && <AppText className="text-sm text-[#7a1d1d]">{error}</AppText>}
          <AppText className="text-xs text-[#2e2c18]">
            First time with this Pass? Enter its 64-character application pairing key. VaultPass saves it securely on
            this phone after a verified signature.
          </AppText>
          <TextInput
            accessibilityLabel="ITEM application pairing key"
            value={pairingKey}
            onChangeText={setPairingKey}
            placeholder="Application pairing key (first use only)"
            placeholderTextColor="#5c5943"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            className="min-h-12 rounded-xl border border-black px-4 text-black"
          />
          <Button
            variant="inverse"
            icon="tap"
            label={isTapping ? 'Hold your Pass still…' : isConfirming ? 'Confirming…' : 'Tap your Pass'}
            disabled={busy}
            onPress={async () => {
              const uid = await tapPass(
                'Hold your Pass near the top of the phone',
                'sign-in',
                '',
                undefined,
                pairingKey,
              );
              if (uid) setPairingKey('');
              await open(uid);
            }}
          />
          {/* Demo without a Pass, or on devices with no NFC reader (iOS simulator, emulators) */}
          {__DEV__ && (
            <Button
              variant="inverse"
              label="Simulate scan"
              disabled={busy}
              onPress={async () => open(await simulateTap(DEV_CHIP_ID))}
            />
          )}
          <View className="flex-row items-center gap-2">
            <View className="size-1.5 rounded-full bg-success" />
            <AppText className="text-2xs leading-relaxed text-[#2e2c18]">
              Your signing key stays on the chip. Biometrics confirm it is you.
            </AppText>
          </View>
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
