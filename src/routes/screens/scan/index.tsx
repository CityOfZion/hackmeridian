import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Animated, Pressable, View } from 'react-native';
import { withUniwind } from 'uniwind';
import { useTranslation } from 'react-i18next';

import { cardAssets } from '@/components/card/assets';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { DEV_CHIP_ID } from '@/constants';
import { usePassTap } from '@/hooks/use-pass-tap';
import type { Language } from '@/i18n';
import { useSignIn } from '@/hooks/use-sign-in';
import { ScreenLayout } from '@/layouts/screen-layout';

import { useTitleEntrance } from './-use-title-entrance';

const StyledImage = withUniwind(Image);

/** Sign-in: verify a fresh Pass signature, then confirm with local biometrics. */
export function ScanScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { t, i18n } = useTranslation(['screens', 'common']);
  const { vaultStyle, passStyle } = useTitleEntrance();
  const { tapPass, simulateTap, isTapping, error, setError } = usePassTap();
  const { signIn, isConfirming } = useSignIn(setError);
  const busy = isTapping || isConfirming;
  const openPairing = () => navigation.navigate('(drawers)/pass/pairing-key');

  // The tapped Pass has no pairing key saved on this phone: ask for it in the pairing drawer
  const tap = async () => signIn(await tapPass(t('scan.tapPrompt'), undefined, openPairing));

  return (
    <ScreenLayout className="bg-brass pt-safe pb-safe">
      {/* No Header on this screen, so the root takes the safe-area insets. */}
      <ScreenLayout.Body contentContainerClassName="grow pt-11.5 pb-6">
        {isFocused && <StatusBar style="dark" />}

        <View>
          <View className="mb-6 flex-row items-center justify-between">
            <StyledImage
              source={cardAssets.logoWhite.source}
              tintColor="#111"
              contentFit="contain"
              className="h-7.25 w-29.25"
              accessibilityLabel="Stellar"
            />
            {/* Same round icon button as the dashboard header (sign out, language), drawn dark for the brass screen */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common:language.label')}
              accessibilityValue={{ text: t(`common:language.names.${i18n.language as Language}`) }}
              onPress={() => navigation.navigate('(drawers)/settings/language')}
              className="size-11 items-center justify-center rounded-full border border-[#111] active:opacity-70"
            >
              <Icon name="globe" color="#111" />
            </Pressable>
          </View>
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
          <AppText className="mt-4.5 max-w-70 text-lg leading-tight text-[#111]">{t('scan.tagline')}</AppText>
        </View>

        <View className="mt-auto gap-3 border-t border-[#111] pt-5">
          {error && <AppText className="text-sm text-[#7a1d1d]">{error}</AppText>}
          <Button
            variant="inverse"
            icon="tap"
            label={
              isTapping
                ? t('common:tap.holdStill')
                : isConfirming
                  ? t('common:tap.confirming')
                  : t('common:tap.tapYourPass')
            }
            disabled={busy}
            onPress={tap}
          />
          {/* Demo without a Pass, or on devices with no NFC reader (iOS simulator, emulators) */}
          {__DEV__ && (
            <Button
              variant="inverse"
              label={t('scan.simulate')}
              disabled={busy}
              onPress={async () => signIn(await simulateTap(DEV_CHIP_ID))}
            />
          )}
          <View className="flex-row items-center gap-2">
            <View className="size-1.5 rounded-full bg-success" />
            <AppText className="text-2xs leading-relaxed text-[#2e2c18]">{t('scan.footer')}</AppText>
          </View>
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
