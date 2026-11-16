import React, { useMemo } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';

// Crisp large rendering: one View per pixel (use for big previews, not lists).
export function PixelGrid({ pixels, width, height, palette, size }: {
  pixels: number[];
  width: number;
  height: number;
  palette: string[];
  size: number;           // rendered height in dp
}) {
  const cs = size / height;
  return (
    <View style={{ width: cs * width, height: size, backgroundColor: '#000' }}>
      {pixels.map((ci, i) => (ci ? (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: (i % width) * cs,
            top: Math.floor(i / width) * cs,
            width: cs + 0.5,
            height: cs + 0.5,
            backgroundColor: palette[ci] ?? '#000',
          }}
        />
      ) : null))}
    </View>
  );
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return s;
}

function hexToRgb(hex: string | undefined): [number, number, number] {
  const n = parseInt((hex ?? '#000000').replace('#', ''), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 24-bit BMP of the frame, each pixel upscaled `scale` times (keeps it crisp when shown).
export function frameToBmpUri(
  pixels: number[], w: number, h: number, palette: string[], scale = 4,
): string {
  const W = w * scale, H = h * scale;
  const rowSize = (W * 3 + 3) & ~3;
  const size = 54 + rowSize * H;
  const b = new Uint8Array(size);
  const u32 = (o: number, v: number) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = (v >>> 24) & 255; };
  b[0] = 0x42; b[1] = 0x4d; u32(2, size); u32(10, 54);
  u32(14, 40); u32(18, W); u32(22, H); b[26] = 1; b[28] = 24; u32(34, rowSize * H);
  const rgb = palette.map(hexToRgb);
  for (let Y = 0; Y < H; Y++) {
    const y = Math.floor((H - 1 - Y) / scale); // BMP rows are bottom-up
    let o = 54 + Y * rowSize;
    for (let X = 0; X < W; X++) {
      const c = rgb[pixels[y * w + Math.floor(X / scale)]] ?? [0, 0, 0];
      b[o++] = c[2]; b[o++] = c[1]; b[o++] = c[0];
    }
  }
  return 'data:image/bmp;base64,' + base64(b);
}

export function PixelImage({ pixels, width, height, palette, size, style }: {
  pixels: number[];
  width: number;
  height: number;
  palette: string[];
  size: number;           // rendered height in dp
  style?: StyleProp<ImageStyle>;
}) {
  // Upscale so bilinear stretching stays fairly crisp without large bitmaps.
  const scale = Math.max(2, Math.min(8, Math.ceil((size * 1.5) / height)));
  const uri = useMemo(
    () => frameToBmpUri(pixels, width, height, palette, scale),
    [pixels, width, height, palette, scale],
  );
  return (
    <Image
      source={{ uri }}
      style={[{ height: size, width: (size * width) / height }, style]}
      resizeMode="stretch"
      fadeDuration={0}
    />
  );
}
