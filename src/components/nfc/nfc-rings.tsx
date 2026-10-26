import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/utils/cn';

// Outer, middle and inner ring.
const RING_INSETS = ['inset-0', 'inset-5.5', 'inset-11.25'];
const DURATION = 2000;
/** Each ring trails the previous one by this fraction of a cycle (300 ms of 2 s). */
const RING_PHASE = 0.15;

/** Opacity and scale for each ring, phase-shifted from one 0 → 1 loop. */
function ringStyles(cycle: Animated.Value) {
  return RING_INSETS.map((_, index) => {
    // 0 → 1 → 0 once per cycle, eased, starting `index * RING_PHASE` later than the outer ring
    const pulse = Animated.modulo(Animated.add(cycle, 1 - index * RING_PHASE), 1).interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 1, 0],
      easing: Easing.inOut(Easing.ease),
    });
    return {
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
    };
  });
}

/**
 * Pulsing contactless rings shown while the app waits for and talks to the Pass. One linear native-driven loop
 * drives all rings (phase-shifted with `modulo`), so the pulse keeps running for the whole scan, even while the JS
 * thread is busy with the card.
 */
export function NfcRings() {
  const [cycle] = useState(() => new Animated.Value(0));
  // Built once, so re-renders (the tap modal updates every step) don't re-attach the running animation
  const [styles] = useState(() => ringStyles(cycle));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(cycle, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [cycle]);

  return (
    <View className="mx-auto mt-1 mb-7 size-41.25 items-center justify-center">
      {RING_INSETS.map((inset, index) => (
        <Animated.View
          key={inset}
          className={cn('absolute rounded-full border border-[#6c5d3d]', inset)}
          style={styles[index]}
        />
      ))}
      <Icon name="tap" size={42} />
    </View>
  );
}
