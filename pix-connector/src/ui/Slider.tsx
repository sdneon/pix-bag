import React, { useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

// Tap or drag anywhere on the track. onChange fires continuously, onRelease once at the end.
export function Slider({ value, min = 0, max = 100, step = 1, disabled, onChange, onRelease, color = '#00d4ff', trackStyle }: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  onRelease?: (v: number) => void;
  color?: string;
  trackStyle?: object;
}) {
  const ref = useRef<View>(null);
  const geo = useRef({ x: 0, w: 1 });
  const last = useRef(value);
  const props = useRef({ min, max, step, disabled, onChange, onRelease });
  props.current = { min, max, step, disabled, onChange, onRelease };

  const fromPageX = (pageX: number) => {
    const p = props.current;
    const t = Math.max(0, Math.min(1, (pageX - geo.current.x) / geo.current.w));
    const v = Math.round((p.min + t * (p.max - p.min)) / p.step) * p.step;
    const clamped = Math.max(p.min, Math.min(p.max, v));
    if (clamped !== last.current) {
      last.current = clamped;
      p.onChange(clamped);
    }
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !props.current.disabled,
    onMoveShouldSetPanResponder: () => !props.current.disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const { pageX } = e.nativeEvent;
      last.current = NaN;
      ref.current?.measure((_x, _y, w, _h, px) => {
        geo.current = { x: px, w: Math.max(1, w) };
        fromPageX(pageX);
      });
    },
    onPanResponderMove: e => fromPageX(e.nativeEvent.pageX),
    onPanResponderRelease: () => props.current.onRelease?.(last.current),
    onPanResponderTerminate: () => props.current.onRelease?.(last.current),
  })).current;

  const pct = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.hit, disabled && styles.disabled]}
      {...pan.panHandlers}
    >
      <View style={[styles.track, trackStyle]} pointerEvents="none">
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <View style={[styles.thumb, { left: `${pct}%` as any, backgroundColor: color }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  hit:      { height: 36, justifyContent: 'center', flexGrow: 1 },
  disabled: { opacity: 0.4 },
  track:    { height: 8, backgroundColor: '#1e1e1e', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  fill:     { height: '100%' },
  thumb:    { position: 'absolute', width: 22, height: 22, marginLeft: -11, borderRadius: 11, borderWidth: 2, borderColor: '#fff' },
});
