import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Backpack } from '../ble/Backpack';
import { MODE_ANIMATION } from '../ble/constants';
import { durationsToBytes } from '../storage/AnimationStore';
import { BINGO_PALETTE, HistoryMode, bingoAnimation, welcomeAnimation } from './bingoDisplay';

interface Props {
  device: Backpack;
  onBack: () => void;
}

type Game = { max: 75 | 90; called: number[]; history?: HistoryMode };
const HISTORY: { key: HistoryMode; label: string }[] = [
  { key: 'off', label: 'Off' }, { key: 'last2', label: 'Last 2' }, { key: 'scroll', label: 'Scroll 5' },
];
const KEY = '@pixbag/bingo';
const LETTERS = 'BINGO';
// 75-ball columns: B blue, I red, N white, G green, O yellow. 90-ball: white.
const COL_RGB: [number, number, number][] = [[40, 120, 255], [255, 40, 40], [255, 255, 255], [40, 220, 80], [255, 210, 0]];

const letterOf = (g: Game, n: number) => (g.max === 75 ? LETTERS[Math.floor((n - 1) / 15)] : '');
const rgbOf = (g: Game, n: number): [number, number, number] =>
  (g.max === 75 ? COL_RGB[Math.floor((n - 1) / 15)] : [255, 255, 255]);

// Tallies called numbers (kept across app restarts) and shows the latest one on the backpack.
export function BingoScreen({ device, onBack }: Props) {
  const [game, setGame] = useState<Game>({ max: 75, called: [] });
  const [show, setShow] = useState(true);
  const [status, setStatus] = useState('');
  const size = useRef({ w: 16, h: 20 });
  const sending = useRef(Promise.resolve());
  const generation = useRef(0);
  const cleanup = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (cleanup.current) clearTimeout(cleanup.current); }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(s => { if (s) setGame(JSON.parse(s)); }).catch(() => {});
    Promise.all([device.readWidth(), device.readHeight()])
      .then(([w, h]) => { size.current = { w, h }; })
      .catch(() => {})
      .finally(() => display({ max: 75, called: [] }, false, true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  const current = game.called[game.called.length - 1];

  // Uploads a short transient animation (not saved to the backpack's memory); uploads are queued and
  // a newer one supersedes the sparkle clean-up of an older one.
  // Welcome ("Bingo" scrolling) when asked for or when no number has been called yet.
  const display = useCallback((g: Game, isNew: boolean, welcome = false) => {
    const gen = ++generation.current;
    if (cleanup.current) { clearTimeout(cleanup.current); cleanup.current = null; }
    sending.current = sending.current.then(async () => {
      if (gen !== generation.current) return;
      const { w, h } = size.current;
      const n = g.called[g.called.length - 1];
      const hello = welcome || !n;
      const anim = hello ? welcomeAnimation(w, h) : bingoAnimation(g.max, g.called, w, h, g.history ?? 'last2', isNew);
      try {
        setStatus(hello ? 'Sending welcome…' : `Sending ${letterOf(g, n)}${n}…`);
        await device.setRenderModeNone();
        await device.setFrameCount(0);
        await device.setPalette(BINGO_PALETTE, 0);
        for (let i = 0; i < anim.frames.length; i++) {
          if (anim.frames.length > 4) setStatus(`Sending ${i + 1}/${anim.frames.length}…`);
          await device.setFrame(i, anim.frames[i]);
        }
        await device.setFrameDurations(durationsToBytes(anim.durations));
        await device.setAnimationDirection(anim.direction);
        await device.setFrameCount(anim.frames.length);
        await device.setRenderMode(MODE_ANIMATION);
        setStatus('');
        // The animation loops, so swap in sparkle-free frames once the sparkle has played.
        const clean = anim.clean;
        if (clean) {
          cleanup.current = setTimeout(() => {
            sending.current = sending.current.then(async () => {
              if (gen !== generation.current) return;
              for (let i = 0; i < clean.length; i++) {
                if (clean[i] !== anim.frames[i]) await device.setFrame(i, clean[i]).catch(() => {});
              }
            });
          }, 3000);
        }
      } catch (e: any) {
        setStatus(`Backpack: ${e.message}`);
      }
    });
  }, [device]);

  const update = (g: Game, isNew = false) => {
    setGame(g);
    AsyncStorage.setItem(KEY, JSON.stringify(g)).catch(() => {});
    if (show) display(g, isNew);
  };

  const draw = () => {
    const left = Array.from({ length: game.max }, (_, i) => i + 1).filter(n => !game.called.includes(n));
    if (!left.length) { Alert.alert('Bingo', 'All numbers have been called.'); return; }
    update({ ...game, called: [...game.called, left[Math.floor(Math.random() * left.length)]] }, true);
  };

  // Tap a number to mark it called (it becomes the current number); tap again to unmark.
  const toggle = (n: number) => {
    const on = game.called.includes(n);
    update({ ...game, called: on ? game.called.filter(x => x !== n) : [...game.called, n] }, !on);
  };

  const undo = () => update({ ...game, called: game.called.slice(0, -1) });

  const newGame = (max: 75 | 90) => {
    const go = () => update({ max, called: [], history: game.history });
    if (!game.called.length) { go(); return; }
    Alert.alert('New game', 'Clear all called numbers?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New game', style: 'destructive', onPress: go },
    ]);
  };

  const rows = game.max === 75 ? 5 : 9;
  const perRow = game.max === 75 ? 15 : 10;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bingo</Text>
        <View style={{ flex: 1 }} />
        {([75, 90] as const).map(m => (
          <TouchableOpacity key={m} onPress={() => m !== game.max && newGame(m)} style={[styles.chip, game.max === m && styles.chipOn]}>
            <Text style={[styles.chipText, game.max === m && styles.chipTextOn]}>1-{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status sits beside the number in a fixed-size box, so nothing below moves. */}
      <View style={styles.currentRow}>
        <View style={styles.currentBox}>
          <Text style={[styles.current, current ? { color: `rgb(${rgbOf(game, current).join(',')})` } : null]}>
            {current ? `${letterOf(game, current)}${letterOf(game, current) ? ' ' : ''}${current}` : '–'}
          </Text>
          <Text style={styles.count}>{game.called.length} / {game.max} called</Text>
        </View>
        <Text style={styles.status} numberOfLines={3}>{status}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.drawBtn} onPress={draw}>
          <Text style={styles.drawText}>Draw next</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={undo} disabled={!game.called.length}>
          <Text style={[styles.btnText, !game.called.length && styles.dim]}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => newGame(game.max)}>
          <Text style={styles.btnText}>New game</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => { setShow(s => !s); if (!show) display(game, false); }} style={styles.showRow}>
        <View style={[styles.check, show && styles.checkOn]} />
        <Text style={styles.btnText}>Show current number on backpack</Text>
      </TouchableOpacity>
      <View style={styles.historyRow}>
        <Text style={styles.count}>Recent numbers on backpack:</Text>
        {HISTORY.map(o => (
          <TouchableOpacity
            key={o.key}
            onPress={() => update({ ...game, history: o.key })}
            style={[styles.chip, (game.history ?? 'last2') === o.key && styles.chipOn]}
          >
            <Text style={[styles.chipText, (game.history ?? 'last2') === o.key && styles.chipTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.board}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={styles.boardRow}>
            {game.max === 75 && <Text style={[styles.rowLetter, { color: `rgb(${COL_RGB[r].join(',')})` }]}>{LETTERS[r]}</Text>}
            {Array.from({ length: perRow }, (_, c) => {
              const n = r * perRow + c + 1;
              const on = game.called.includes(n);
              return (
                <TouchableOpacity key={n} onPress={() => toggle(n)} style={[styles.cell, on && styles.cellOn, n === current && styles.cellCurrent]}>
                  <Text style={[styles.cellText, on && styles.cellTextOn]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0a0a0a', padding: 12 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backBtn:     { paddingRight: 10, paddingVertical: 8 },
  backText:    { color: '#00d4ff', fontSize: 16 },
  title:       { color: '#fff', fontSize: 22, fontWeight: '700' },
  chip:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#333' },
  chipOn:      { borderColor: '#00d4ff', backgroundColor: '#0b2a33' },
  chipText:    { color: '#888', fontWeight: '700' },
  chipTextOn:  { color: '#00d4ff' },
  currentRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8 },
  currentBox:  { alignItems: 'center', minWidth: 150 },
  current:     { color: '#fff', fontSize: 56, fontWeight: '900' },
  count:       { color: '#888', fontSize: 13 },
  status:      { color: '#ffa500', fontSize: 12, width: 110, height: 48, textAlignVertical: 'center' },
  historyRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  actions:     { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 8 },
  drawBtn:     { backgroundColor: '#ffa500', borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  drawText:    { color: '#000', fontSize: 16, fontWeight: '900' },
  btn:         { backgroundColor: '#1e1e1e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#333' },
  btnText:     { color: '#fff', fontWeight: '600' },
  dim:         { opacity: 0.4 },
  showRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginBottom: 8 },
  check:       { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#555' },
  checkOn:     { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  board:       { gap: 4, paddingBottom: 24 },
  boardRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  rowLetter:   { width: 18, fontWeight: '900', fontSize: 15 },
  cell:        { minWidth: 30, paddingVertical: 5, borderRadius: 6, backgroundColor: '#161616', alignItems: 'center', borderWidth: 1, borderColor: '#262626' },
  cellOn:      { backgroundColor: '#0b2a33', borderColor: '#00d4ff' },
  cellCurrent: { backgroundColor: '#ffa500', borderColor: '#ffa500' },
  cellText:    { color: '#666', fontSize: 12, fontWeight: '700' },
  cellTextOn:  { color: '#fff' },
});
