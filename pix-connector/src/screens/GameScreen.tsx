import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Backpack } from '../ble/Backpack';
import { GAMES, GameKey } from '../ble/modes';

interface Props {
  device: Backpack;
  game: GameKey;
  onBack: () => void;
}

// Gamepad for the backpack's built-in games (config + input codes as in the original app).
export function GameScreen({ device, game, onBack }: Props) {
  const g = GAMES[game];
  const [status, setStatus] = useState('Starting…');
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = useCallback(() => {
    if (repeat.current) { clearInterval(repeat.current); repeat.current = null; }
  }, []);

  useEffect(() => {
    device.setRenderMode(g.config)
      .then(() => setStatus(''))
      .catch(e => setStatus(`Could not start: ${e.message}`));
    return stopRepeat;
  }, [device, g, stopRepeat]);

  const send = useCallback((v: number) => {
    device.sendInput(v).catch(e => { stopRepeat(); Alert.alert('Error', e.message); });
  }, [device, stopRepeat]);

  // Hold to repeat every 150 ms.
  const hold = (v: number) => () => { stopRepeat(); send(v); repeat.current = setInterval(() => send(v), 150); };

  const Pad = ({ label, v }: { label: string; v?: number }) => (v === undefined
    ? <View style={styles.empty} />
    : (
      <TouchableOpacity style={styles.btn} onPressIn={hold(v)} onPressOut={stopRepeat} activeOpacity={0.6}>
        <Text style={styles.btnLabel}>{label}</Text>
      </TouchableOpacity>
    ));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{g.label}</Text>
      </View>
      <Text style={styles.about}>{g.about}</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.pad}>
        <View style={styles.dpad}>
          <View style={styles.row}><Pad label="" /><Pad label="▲" v={g.input.up} /><Pad label="" /></View>
          <View style={styles.row}><Pad label="◄" v={g.input.left} /><View style={styles.center} /><Pad label="►" v={g.input.right} /></View>
          <View style={styles.row}><Pad label="" /><Pad label="▼" v={g.input.down} /><Pad label="" /></View>
        </View>
        {g.input.a !== undefined && (
          <TouchableOpacity style={styles.aBtn} onPressIn={hold(g.input.a)} onPressOut={stopRepeat} activeOpacity={0.6}>
            <Text style={styles.aLabel}>{g.aLabel ?? 'A'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Hold a button to repeat</Text>
    </View>
  );
}

const BTN = 76;
const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  header:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn:  { paddingRight: 16, paddingVertical: 8 },
  backText: { color: '#00d4ff', fontSize: 16 },
  title:    { color: '#fff', fontSize: 22, fontWeight: '700' },
  about:    { color: '#888', fontSize: 13, marginBottom: 8 },
  status:   { color: '#ff9900', fontSize: 13, textAlign: 'center' },
  pad:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 },
  dpad:     { gap: 4 },
  row:      { flexDirection: 'row', gap: 4 },
  btn:      { width: BTN, height: BTN, backgroundColor: '#2a2a2a', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#444' },
  empty:    { width: BTN, height: BTN },
  center:   { width: BTN, height: BTN, backgroundColor: '#1a1a1a', borderRadius: 12 },
  btnLabel: { color: '#fff', fontSize: 28, fontWeight: '700' },
  aBtn:     { width: 110, height: 110, backgroundColor: '#8b0000', borderRadius: 55, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#e74c3c' },
  aLabel:   { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  hint:     { color: '#555', fontSize: 12, textAlign: 'center', paddingBottom: 16 },
});
