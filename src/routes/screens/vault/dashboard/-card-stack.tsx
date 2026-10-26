import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  useAnimatedValue,
  View,
  type LayoutAnimationConfig,
} from 'react-native';

import type { Card } from '@/api/types';
import { CARD_ASPECT_RATIO, PhysicalCard } from '@/components/card/physical-card';
import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/utils/cn';
import { formatAmount } from '@/utils/format';

/** Visible height of a card tucked behind the next one: its caption strip. */
const PEEK = 60;
/** Space between cards when the stack is expanded. */
const EXPANDED_GAP = 20;
/** Delay between cards dealt onto the stack when it first shows. */
const ENTRANCE_STAGGER_MS = 90;

/** Cards spring into place; details panels fade in and out. */
const STACK_TRANSITION: LayoutAnimationConfig = {
  duration: 480,
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity, duration: 240 },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity, duration: 160 },
};

type Props = {
  cards: Card[];
  selectedId: string;
  onSelect: (cardId: string) => void;
};

/**
 * Cards stacked back to back, each showing only its top strip, with the selected card in front. Tapping the stack
 * expands it so every card shows in full with its details; tapping a card there selects it and collapses the stack.
 */
export function CardStack({ cards, selectedId, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const reduceMotion = useReduceMotion();

  // Later cards render on top, so the selected card goes last to sit in front when collapsed
  const ordered = expanded
    ? cards
    : [...cards.filter((card) => card.id !== selectedId), ...cards.filter((card) => card.id === selectedId)];

  const press = (cardId: string) => {
    if (!reduceMotion) LayoutAnimation.configureNext(STACK_TRANSITION);
    if (expanded) onSelect(cardId);
    setExpanded((current) => !current);
  };

  return (
    <View onLayout={(event) => setCardHeight(event.nativeEvent.layout.width / CARD_ASPECT_RATIO)}>
      {ordered.map((card, index) => {
        const selected = card.id === selectedId;
        // Collapsed: overlap the previous card so only its strip shows (once the card height is measured)
        const marginTop = index === 0 ? 0 : expanded || cardHeight === 0 ? EXPANDED_GAP : PEEK - cardHeight;

        return (
          <StackedCard
            key={card.id}
            card={card}
            // Entrance order follows the cards, not the stack, so the front card lands last
            entranceIndex={cards.indexOf(card)}
            selected={selected}
            expanded={expanded}
            reduceMotion={reduceMotion}
            marginTop={marginTop}
            onPress={() => press(card.id)}
          />
        );
      })}
      {cards.length > 1 && (
        <AppText className="mt-3 text-center text-2xs text-muted">
          {expanded ? 'Tap a card to select it' : 'Tap the cards to choose another'}
        </AppText>
      )}
    </View>
  );
}

type StackedCardProps = {
  card: Card;
  entranceIndex: number;
  selected: boolean;
  expanded: boolean;
  reduceMotion: boolean | undefined;
  marginTop: number;
  onPress: () => void;
};

function StackedCard({ card, entranceIndex, selected, expanded, reduceMotion, marginTop, onPress }: StackedCardProps) {
  const entrance = useAnimatedValue(0);
  const press = useAnimatedValue(1);

  // Deal the card onto the stack: rise and fade in, one after another
  useEffect(() => {
    if (reduceMotion === undefined) return;
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      delay: entranceIndex * ENTRANCE_STAGGER_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [entrance, entranceIndex, reduceMotion]);

  const pressTo = (toValue: number) => {
    if (reduceMotion) return;
    Animated.spring(press, { toValue, speed: 40, bounciness: toValue === 1 ? 8 : 0, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded, selected }}
      accessibilityLabel={`${card.label} card ending ${card.last4}`}
      accessibilityHint={expanded ? 'Selects this card' : 'Shows all your cards'}
      onPress={onPress}
      onPressIn={() => pressTo(0.97)}
      onPressOut={() => pressTo(1)}
      style={{ marginTop }}
    >
      <Animated.View
        style={{
          opacity: entrance,
          transform: [
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
            { scale: Animated.multiply(press, entrance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] })) },
          ],
        }}
      >
        <PhysicalCard
          design={card.design}
          caption={{ title: card.label, detail: `•••• ${card.last4}` }}
          className={cn(expanded && selected && 'border-2 border-brass')}
        />
        {(expanded || selected) && (
          <View
            className={cn(
              'mt-3 flex-row items-center gap-2 rounded-lg border bg-panel p-3.75',
              selected ? 'border-brass' : 'border-line',
            )}
          >
            {selected && <Icon name="check" size={16} />}
            <AppText className={cn('flex-1 text-2xs tracking-widest', selected ? 'text-brass' : 'text-muted')}>
              {selected ? 'SELECTED · LOADED' : 'LOADED'}
            </AppText>
            <AppText className="font-outfit-semibold text-sm">{formatAmount(card.loadedBalance)} EURC</AppText>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** `undefined` until the setting is read, so animations don't start before knowing. */
function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState<boolean>();

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}
