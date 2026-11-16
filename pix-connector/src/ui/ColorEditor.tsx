import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Slider } from './Slider';
import { Btn, C } from './Btn';

function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16) || 0;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [Math.round(h), Math.round(max ? (d / max) * 100 : 0), Math.round(max * 100)];
}

export function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (f: number) => Math.round((f + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const QUICK = [
  '#000000', '#ffffff', '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80',
  '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080', '#804000', '#808080',
];

export function ColorEditor({ visible, color, onDone, onCancel }: {
  visible: boolean;
  color: string;
  onDone: (hex: string) => void;
  onCancel: () => void;
}) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color));
  const [hexText, setHexText] = useState(color);
  useEffect(() => {
    if (visible) { setHsv(hexToHsv(color)); setHexText(color); }
  }, [visible, color]);

  const hex = hsvToHex(hsv[0], hsv[1], hsv[2]);
  const setPart = (i: number, v: number) => {
    const next = [...hsv] as [number, number, number];
    next[i] = v;
    setHsv(next);
    setHexText(hsvToHex(next[0], next[1], next[2]));
  };
  const pick = (h: string) => { setHsv(hexToHsv(h)); setHexText(h); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Edit colour</Text>
          <View style={[styles.preview, { backgroundColor: hex }]} />
          <Row label="Hue"><Slider value={hsv[0]} max={359} onChange={v => setPart(0, v)} color={hsvToHex(hsv[0], 100, 100)} /></Row>
          <Row label="Sat"><Slider value={hsv[1]} onChange={v => setPart(1, v)} color={hex} /></Row>
          <Row label="Bright"><Slider value={hsv[2]} onChange={v => setPart(2, v)} color={hex} /></Row>
          <View style={styles.hexRow}>
            <Text style={styles.label}>Hex</Text>
            <TextInput
              style={styles.hexInput}
              value={hexText}
              autoCapitalize="none"
              onChangeText={t => {
                setHexText(t);
                if (/^#?[0-9a-fA-F]{6}$/.test(t)) setHsv(hexToHsv(t.startsWith('#') ? t : '#' + t));
              }}
            />
          </View>
          <View style={styles.quick}>
            {QUICK.map(q => (
              <TouchableOpacity key={q} onPress={() => pick(q)} style={[styles.quickCell, { backgroundColor: q }]} />
            ))}
          </View>
          <View style={styles.btns}>
            <Btn label="Cancel" onPress={onCancel} />
            <Btn label="OK" primary onPress={() => onDone(hex)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  box:       { backgroundColor: '#111', borderRadius: 16, padding: 20, width: 360, maxWidth: '92%', gap: 6 },
  title:     { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  preview:   { height: 48, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 6 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label:     { color: C.dim, width: 52, fontSize: 13 },
  hexRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  hexInput:  { flex: 1, color: C.text, fontSize: 15, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 4, fontFamily: 'monospace' },
  quick:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  quickCell: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  btns:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
});
