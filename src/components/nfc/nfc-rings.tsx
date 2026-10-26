import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/utils/cn';

// Outer, middle and inner ring.
const RING_INSETS = ['inset-0', 'inset-5.5', 'inset-11.25'];
const DURATION = 2000;

/** Pulsing contactless rings shown while the terminal waits for a tap. */
export function NfcRings() {
  const [values] = useState(() => RING_INSETS.map(() => new Animated.Value(0)));

  useEffect(() => {
    const loops = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 300),
          Animated.timing(value, {
            toValue: 1,
            duration: DURATION / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: DURATION / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);

  return (
    <View className="mx-auto mt-1 mb-7 size-41.25 items-center justify-center">
      {RING_INSETS.map((inset, index) => (
        <Animated.View
          key={inset}
          className={cn('absolute rounded-full border border-[#6c5d3d]', inset)}
          style={{
            opacity: values[index].interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [{ scale: values[index].interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
          }}
        />
      ))}
      <Icon name="tap" size={42} />
    </View>
  );
}
