import { StyleSheet } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';

// Card is drawn in a 158.4 × 100 box (ISO card ratio 1.584).
const WIDTH = 158.4;
const HEIGHT = 100;

// Port of `repeating-linear-gradient(62deg, transparent 0 14%, COLOR 14% 27%, transparent 27% 43%)`
// on a layer inset -35% and shifted -7%: the gradient line is ~317.6 units long, so one
// period (43%) is 136.6 units, starting at the layer's bottom-left corner (-74.3, 135).
const ORIGIN = { x: -74.3, y: 135 };
const ANGLE = -28; // 62deg CSS gradient direction, expressed as an SVG rotation of the x axis
const PERIOD = 136.6;
const BAND_START = 44.5;
const BAND_WIDTH = 41.3;
const BAND_COUNT = 3; // enough to cover the card
const BAND_LENGTH = 600;

export function DiagonalBands({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
      <G transform={`translate(${ORIGIN.x} ${ORIGIN.y}) rotate(${ANGLE})`}>
        {Array.from({ length: BAND_COUNT }, (_, i) => (
          <Rect
            key={i}
            x={BAND_START + i * PERIOD}
            y={-BAND_LENGTH / 2}
            width={BAND_WIDTH}
            height={BAND_LENGTH}
            fill={color}
          />
        ))}
      </G>
    </Svg>
  );
}
