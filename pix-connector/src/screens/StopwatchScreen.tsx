import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Backpack } from '../ble/Backpack';
import { STOPWATCH } from '../ble/modes';

interface Props {
  device: Backpack;
  onBack: () => void;
}

// Stopwatch runs on the backpack; the app only sends start / stop / lap / reset.
export function StopwatchScreen({ device, onBack }: Props) {
  const [status, setStatus] = useState('Starting…');

  useEffect(() => {
    device.setRenderMode(STOPWATCH.config)
      .then(() => setStatus('Ready'))
      .catch(e => setStatus(`Could not start: ${e.message}`));
  }, [device]);

  const send = (v: number, label: string) => {
    device.sendInput(v).then(() => setStatus(label)).catch(e => Alert.alert('Error', e.message));
  };

  const B = ({ label, v, color }: { label: string; v: number; color: string }) => (
    <TouchableOpacity style={[styles.btn, { borderColor: color }]} onPress={() => send(v, label)}>
      <Text style={[styles.btnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Stopwatch</Text>
      </View>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.grid}>
        <B label="Start" v={STOPWATCH.input.start} color="#2ecc71" />
        <B label="Stop" v={STOPWATCH.input.stop} color="#e74c3c" />
        <B label="Lap" v={STOPWATCH.input.lap} color="#00d4ff" />
        <B label="Reset" v={STOPWATCH.input.reset} color="#ffa500" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  header:   { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn:  { paddingRight: 16, paddingVertical: 8 },
  backText: { color: '#00d4ff', fontSize: 16 },
  title:    { color: '#fff', fontSize: 22, fontWeight: '700' },
  status:   { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  btn:      { width: 140, height: 90, borderRadius: 16, borderWidth: 2, backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center' },
  btnText:  { fontSize: 22, fontWeight: '800' },
});
