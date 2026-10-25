import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cardAssets } from '../components/card/assets';
import { AppText } from '../components/ui/AppText';
import { Icon, type IconName } from '../components/ui/Icon';

const INK = '#111';

const roles = [
  { route: 'Bank', icon: 'bank', name: 'Bank', description: 'Issue cards and oversee the network.' },
  { route: 'CardHolder', icon: 'card', name: 'Card Holder', description: 'Your card, balance and controls.' },
  { route: 'Merchant', icon: 'shop', name: 'Merchant', description: 'Accept a secure tap payment.' },
] as const satisfies readonly { route: string; icon: IconName; name: string; description: string }[];

/** "Vault" slides in from the left and "Pass" from the right. */
function useTitleEntrance() {
  const vault = useRef(new Animated.Value(0)).current;
  const pass = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        vault.setValue(1);
        pass.setValue(1);
        return;
      }
      const config = { toValue: 1, duration: 750, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true };
      Animated.parallel([Animated.timing(vault, config), Animated.timing(pass, { ...config, delay: 120 })]).start();
    });
  }, [vault, pass]);

  const slide = (value: Animated.Value, from: number) => ({
    opacity: value,
    transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
  });

  return { vaultStyle: slide(vault, -28), passStyle: slide(pass, 28) };
}

export function RoleSelectScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { vaultStyle, passStyle } = useTitleEntrance();

  return (
    <ScrollView
      className="flex-1 bg-brass"
      contentContainerClassName="grow px-[22px]"
      contentContainerStyle={{ paddingTop: insets.top + 46, paddingBottom: insets.bottom + 24 }}
    >
      {isFocused && <StatusBar style="dark" />}

      <View>
        <Image
          source={cardAssets.logoWhite.source}
          tintColor={INK}
          contentFit="contain"
          style={{ width: 117, height: 29, marginBottom: 24 }}
          accessibilityLabel="Stellar"
        />
        <AppText className="font-outfit-semibold text-[10px] tracking-[1.2px] text-[#111]">ITEM SYSTEMS · NFI v3</AppText>
        <View className="mt-[18px] flex-row overflow-hidden" accessible accessibilityRole="header" accessibilityLabel="VaultPass">
          <Animated.Text style={vaultStyle} className="font-outfit-semibold text-[56px] leading-[56px] text-[#111]">
            Vault
          </Animated.Text>
          <Animated.Text style={passStyle} className="font-outfit-semibold text-[56px] leading-[56px] text-[#111]">
            Pass
          </Animated.Text>
        </View>
        <AppText className="mt-[18px] max-w-[280px] text-[17px] leading-[20px] text-[#111]">
          Hardware-secured payments.{'\n'}Choose your operating mode.
        </AppText>
      </View>

      <View className="mb-[22px] mt-12 border-t border-[#111]">
        {roles.map((role, index) => (
          <Pressable
            key={role.route}
            accessibilityRole="button"
            accessibilityLabel={`${role.name}. ${role.description}`}
            onPress={() => navigation.navigate(role.route)}
            className="min-h-[82px] flex-row items-center gap-3 border-b border-[#111] px-0.5 py-4 active:scale-[1.02]"
          >
            <AppText className="w-6 self-start text-[10px] text-[#39350f]">0{index + 1}</AppText>
            <View className="size-9 items-center justify-center rounded-full border border-[#111]">
              <Icon name={role.icon} color={INK} />
            </View>
            <View className="flex-1 gap-[5px]">
              <AppText className="font-outfit-semibold text-[22px] leading-[22px] tracking-[-0.6px] text-[#111]">
                {role.name}
              </AppText>
              <AppText className="text-[12px] text-[#39350f]">{role.description}</AppText>
            </View>
            <Icon name="arrow" color={INK} />
          </Pressable>
        ))}
      </View>

      <View className="mt-auto border-t border-[#111] pt-5">
        <AppText className="font-outfit-semibold text-[10px] text-[#111]">SECURE ELEMENT ONLINE</AppText>
        <View className="mt-1 flex-row items-center gap-2">
          <View className="size-1.5 rounded-full bg-success" />
          <AppText className="text-[10px] leading-[17px] text-[#2e2c18]">
            Sovereign self-custody with zero vendor backdoors
          </AppText>
        </View>
      </View>
    </ScrollView>
  );
}
