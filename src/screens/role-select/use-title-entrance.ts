import { useEffect } from 'react';
import { AccessibilityInfo, Animated, Easing, useAnimatedValue } from 'react-native';

/** "Vault" slides in from the left and "Pass" from the right. */
export function useTitleEntrance() {
  const vault = useAnimatedValue(0);
  const pass = useAnimatedValue(0);

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
