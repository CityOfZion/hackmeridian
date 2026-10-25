import { Image } from 'expo-image';
import { View, type ImageStyle } from 'react-native';

import type { CardDesign, CardState } from '../../store/slices/holders-slice';
import { colors } from '../../theme/colors';
import { cn } from '../../utils/cn';
import { AppText } from '../ui/app-text';
import { Icon } from '../ui/icon';
import { StatusPill } from '../ui/status-pill';
import { cardAssets } from './assets';
import { DiagonalBands } from './diagonal-bands';

type Asset = (typeof cardAssets)[keyof typeof cardAssets];
type Placed = { asset: Asset; style: ImageStyle };

type Face = {
  background?: 'yellowField' | 'yellowBands' | 'blackBands';
  pattern?: Placed;
  logo: Placed;
  nfc: Placed;
  chip: Placed;
};

// Positions are percentages of the card, ported from the Figma Make CSS.
const faces: Record<CardDesign, Face> = {
  a: {
    pattern: {
      asset: cardAssets.patternA,
      style: { width: '147%', left: '-66%', top: '-47%', transform: [{ rotate: '-18.85deg' }] },
    },
    logo: { asset: cardAssets.logoWhite, style: { width: '36.1%', right: '5.2%', top: '7.2%' } },
    nfc: { asset: cardAssets.nfcDark, style: { width: '7.4%', left: '7.4%', top: '7.8%' } },
    chip: {
      asset: cardAssets.chipWhite,
      style: { width: '7.5%', right: '5%', bottom: '7.1%', transform: [{ rotate: '90deg' }] },
    },
  },
  b: {
    pattern: { asset: cardAssets.patternB, style: { width: '202%', left: '-1%', top: '18%' } },
    logo: { asset: cardAssets.logoWhiteCompact, style: { width: '28.5%', right: '4.4%', top: '7.2%' } },
    nfc: { asset: cardAssets.nfcYellow, style: { width: '7.4%', left: '4.6%', bottom: '4.6%' } },
    chip: {
      asset: cardAssets.chipWhite,
      style: { width: '7.5%', right: '4.3%', bottom: '7.1%', transform: [{ rotate: '90deg' }] },
    },
  },
  c: {
    background: 'yellowField',
    logo: {
      asset: cardAssets.logoWhite,
      style: { width: '36%', right: '-13.7%', top: '42%', transform: [{ rotate: '-90deg' }] },
    },
    nfc: {
      asset: cardAssets.nfcDark,
      style: { width: '7.4%', left: '5.5%', bottom: '7.5%', transform: [{ rotate: '-90deg' }] },
    },
    chip: { asset: cardAssets.chipWhite, style: { width: '7.5%', right: '3.2%', top: '7.2%' } },
  },
  d: {
    background: 'yellowBands',
    logo: {
      asset: cardAssets.logoWhite,
      style: { width: '36%', right: '-13.7%', top: '40%', transform: [{ rotate: '-90deg' }] },
    },
    nfc: {
      asset: cardAssets.nfcDark,
      style: { width: '7.4%', left: '5.5%', top: '8.8%', transform: [{ rotate: '-90deg' }] },
    },
    chip: { asset: cardAssets.chipYellow, style: { width: '7.5%', left: '5.6%', bottom: '9%' } },
  },
  e: {
    background: 'blackBands',
    logo: {
      asset: cardAssets.logoYellow,
      style: { width: '36%', right: '-13.7%', top: '14%', transform: [{ rotate: '-90deg' }] },
    },
    nfc: {
      asset: cardAssets.nfcYellow,
      style: { width: '7.4%', left: '5.5%', top: '8.8%', transform: [{ rotate: '-90deg' }] },
    },
    chip: { asset: cardAssets.chipWhiteAlt, style: { width: '7.5%', left: '5.6%', bottom: '9%' } },
  },
};

function PlacedImage({ asset, style }: Placed) {
  return (
    <Image
      source={asset.source}
      contentFit="contain"
      style={[{ position: 'absolute', aspectRatio: asset.aspectRatio }, style]}
    />
  );
}

type Props = {
  state: CardState;
  design?: CardDesign;
  /** Small thumbnail used in the design picker: no overlay or holder name. */
  compact?: boolean;
  holderName?: string;
  className?: string;
};

export function PhysicalCard({ state, design = 'a', compact = false, holderName, className }: Props) {
  const face = faces[design];

  return (
    <View
      accessibilityLabel={`Stellar card, design ${design.toUpperCase()}, ${state.toLowerCase()}`}
      className={cn(
        'aspect-[1.584] w-full overflow-hidden rounded-lg border border-[#555] bg-[#1e1e1e]',
        compact && 'border-[#444]',
        state !== 'ACTIVE' && 'opacity-55',
        className,
      )}
    >
      {face.background === 'yellowField' && (
        <View className="absolute -top-[5%] right-[15%] -bottom-[5%] -left-[14%] bg-brass" />
      )}
      {face.background === 'yellowBands' && <DiagonalBands color={colors.brass} />}
      {face.background === 'blackBands' && <DiagonalBands color="#000" />}
      {face.pattern && <PlacedImage {...face.pattern} />}
      <PlacedImage {...face.logo} />
      <PlacedImage {...face.nfc} />
      <PlacedImage {...face.chip} />

      {!compact && (
        <>
          {holderName && (
            <AppText
              numberOfLines={1}
              className="absolute bottom-[8%] left-[6%] z-10 max-w-[55%] font-outfit-medium text-2xs tracking-widest text-white uppercase text-shadow-black text-shadow-sm"
            >
              {holderName}
            </AppText>
          )}
          <View className="absolute inset-0 flex-row items-end justify-end gap-2.25 bg-linear-to-b from-transparent from-55% to-black/55 p-3.25">
            <StatusPill value={state} className="self-end" />
            {state !== 'ACTIVE' && <Icon name="lock" size={28} color="#eee" />}
          </View>
        </>
      )}
    </View>
  );
}
