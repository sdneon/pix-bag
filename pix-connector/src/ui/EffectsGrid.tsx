import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EFFECTS, EffectKind, generateEffect } from '../editor/effects';
import { C } from './Btn';

// 12×12 demo sprite: 1 = red, 2 = white highlight, 3 = yellow (text / sparkle colour).
const SPRITE = [
  '............', '.111....111.', '11111..11111', '112111111111',
  '121111111111', '111111111111', '.1111111111.', '..11111111..',
  '...111111...', '....1111....', '.....11.....', '............',
];
// Small heart for the Rainbow demo, so the rings around it stay visible.
const SMALL = [
  '............', '............', '............', '............',
  '....1..1....', '....1111....', '....1111....', '.....11.....',
  '............', '............', '............', '............',
];
const DEMO_PAL = ['#000000', '#ff3030', '#ffffff', '#ffd700'];
const N = 12;
const toFrame = (rows: string[]) => rows.join('').split('').map(c => (c === '.' ? 0 : Number(c)));
const BASE = toFrame(SPRITE);
const SMALL_BASE = toFrame(SMALL);
const CYCLE = 60;   // ticks between demos of the same icon
const TICK_MS = 100;

function demoFrames(kind: EffectKind): { frames: number[][]; pal: string[] } {
  const r = generateEffect(kind, kind === 'rainbow' ? SMALL_BASE : BASE, N, N, {
    frames: 8, text: 'Hi', color: 3, dir: 'right', amp: 1, step: 1, palette: DEMO_PAL, rainbowStyle: 'swirl',
  });
  return { frames: r.frames.length ? r.frames : [BASE], pal: r.palette ?? DEMO_PAL };
}

const Mini = memo(function Mini({ frame, size, pal }: { frame: number[]; size: number; pal: string[] }) {
  const cs = size / N;
  return (
    <View style={{ width: size, height: size, backgroundColor: '#000' }}>
      {frame.map((ci, i) => (ci ? (
        <View
          key={i}
          style={{
            position: 'absolute', left: (i % N) * cs, top: Math.floor(i / N) * cs,
            width: cs + 0.4, height: cs + 0.4, backgroundColor: pal[ci] ?? '#fff',
          }}
        />
      ) : null))}
    </View>
  );
});

// Effect buttons; each icon replays its effect every few seconds, staggered.
export function EffectsGrid({ onPick, columns = 5 }: { onPick: (k: EffectKind) => void; columns?: number }) {
  const demos = useMemo(() => EFFECTS.map(e => demoFrames(e.kind)), []);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.grid}>
      {EFFECTS.map((e, i) => {
        const { frames: fr, pal } = demos[i];
        const phase = (tick - i * 4 + CYCLE * 100) % CYCLE;
        const frame = phase < fr.length ? fr[phase] : fr[Math.floor(fr.length / 2)];
        return (
          <TouchableOpacity
            key={e.kind}
            onPress={() => onPick(e.kind)}
            accessibilityLabel={e.label}
            style={[styles.cell, { width: `${100 / columns - 2}%` as any }]}
          >
            <Mini frame={frame} size={30} pal={pal} />
            <Text style={styles.label} numberOfLines={1}>{e.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' },
  cell:  { backgroundColor: C.btn, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center', paddingVertical: 6, gap: 3 },
  label: { color: C.dim, fontSize: 10 },
});
