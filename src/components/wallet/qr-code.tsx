import { useMemo } from 'react';
import makeQr from 'qrcode-generator';
import Svg, { Path, Rect } from 'react-native-svg';

/** Encode the actual address/request with a four-module quiet zone, never a decorative QR. */
export function QrCode({ value }: { value: string }) {
  const { size, path } = useMemo(() => {
    const qr = makeQr(0, 'M');
    qr.addData(value, 'Byte');
    qr.make();
    let path = '';
    const n = qr.getModuleCount();
    for (let row = 0; row < n; row++)
      for (let col = 0; col < n; col++) if (qr.isDark(row, col)) path += `M${col + 4} ${row + 4}h1v1h-1z`;
    return { size: n + 8, path };
  }, [value]);
  return (
    <Svg width="100%" height={260} viewBox={`0 0 ${size} ${size}`} accessibilityLabel="Payment QR code">
      <Rect width={size} height={size} fill="#fff" />
      <Path d={path} fill="#000" />
    </Svg>
  );
}
