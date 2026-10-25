import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Animated, Pressable, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { cardAssets } from '../../components/card/assets';
import { ScreenLayout } from '../../components/layout/screen-layout';
import { AppText } from '../../components/ui/app-text';
import { Icon, type IconName } from '../../components/ui/icon';
import { useTitleEntrance } from './use-title-entrance';

const INK = '#111';

const StyledImage = withUniwind(Image);

const roles = [
  { route: 'Bank', icon: 'bank', name: 'Bank', description: 'Issue cards and oversee the network.' },
  { route: 'CardHolder', icon: 'card', name: 'Card Holder', description: 'Your card, balance and controls.' },
  { route: 'Merchant', icon: 'shop', name: 'Merchant', description: 'Accept a secure tap payment.' },
] as const satisfies readonly { route: string; icon: IconName; name: string; description: string }[];

export function RoleSelectScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { vaultStyle, passStyle } = useTitleEntrance();

  return (
    <ScreenLayout className="bg-brass pt-safe pb-safe">
      {/* No Header on this screen, so the root takes the safe-area insets. */}
      <ScreenLayout.Body contentContainerClassName="grow pt-11.5 pb-6">
        {isFocused && <StatusBar style="dark" />}

        <View>
          <StyledImage
            source={cardAssets.logoWhite.source}
            tintColor={INK}
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
            Hardware-secured payments.{'\n'}Choose your operating mode.
          </AppText>
        </View>

        <View className="mt-12 mb-5.5 border-t border-[#111]">
          {roles.map((role, index) => (
            <Pressable
              key={role.route}
              accessibilityRole="button"
              accessibilityLabel={`${role.name}. ${role.description}`}
              onPress={() => navigation.navigate(role.route)}
              className="min-h-20.5 flex-row items-center gap-3 border-b border-[#111] px-0.5 py-4 active:scale-[1.02]"
            >
              <AppText className="w-6 self-start text-2xs text-[#39350f]">0{index + 1}</AppText>
              <View className="size-9 items-center justify-center rounded-full border border-[#111]">
                <Icon name={role.icon} color={INK} />
              </View>
              <View className="flex-1 gap-1.25">
                <AppText className="font-outfit-semibold text-2xl leading-none tracking-tight text-[#111]">
                  {role.name}
                </AppText>
                <AppText className="text-xs text-[#39350f]">{role.description}</AppText>
              </View>
              <Icon name="arrow" color={INK} />
            </Pressable>
          ))}
        </View>

        <View className="mt-auto border-t border-[#111] pt-5">
          <AppText className="font-outfit-semibold text-2xs text-[#111]">SECURE ELEMENT ONLINE</AppText>
          <View className="mt-1 flex-row items-center gap-2">
            <View className="size-1.5 rounded-full bg-success" />
            <AppText className="text-2xs leading-relaxed text-[#2e2c18]">
              Sovereign self-custody with zero vendor backdoors
            </AppText>
          </View>
        </View>
      </ScreenLayout.Body>
    </ScreenLayout>
  );
}
