import type { ImageSource } from 'expo-image';

type CardAsset = { source: ImageSource; aspectRatio: number };

// aspectRatio = SVG width / height, needed because expo-image can't size SVGs intrinsically.
export const cardAssets = {
  patternA: { source: require('../../../assets/card/pattern-a.svg'), aspectRatio: 475.64 / 402.427 },
  patternB: { source: require('../../../assets/card/pattern-b.svg'), aspectRatio: 653.607 / 185.528 },
  logoWhite: { source: require('../../../assets/card/logo-white.svg'), aspectRatio: 116.808 / 28.5918 },
  logoWhiteCompact: { source: require('../../../assets/card/logo-white-compact.svg'), aspectRatio: 92.1066 / 22.645 },
  logoYellow: { source: require('../../../assets/card/logo-yellow.svg'), aspectRatio: 116.808 / 28.5918 },
  nfcDark: { source: require('../../../assets/card/nfc-dark.svg'), aspectRatio: 1 },
  nfcYellow: { source: require('../../../assets/card/nfc-yellow.svg'), aspectRatio: 1 },
  chipWhite: { source: require('../../../assets/card/chip-white.svg'), aspectRatio: 24.2404 / 24.2658 },
  chipWhiteAlt: { source: require('../../../assets/card/chip-white-alt.svg'), aspectRatio: 24.2404 / 24.2658 },
  chipYellow: { source: require('../../../assets/card/chip-yellow.svg'), aspectRatio: 24.2404 / 24.2658 },
} satisfies Record<string, CardAsset>;
