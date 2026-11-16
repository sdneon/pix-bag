import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import type { Backpack } from '../ble/Backpack';
import { uploadAnimation } from '../ble/upload';
import { AnimationStore, SavedAnimation } from '../storage/AnimationStore';
import { BUILTIN_ANIMATIONS } from '../data/builtinAnimations';
import { saveBackupToFile, shareBackup, importWithAlerts } from '../storage/BackupService';
import { PixelImage } from '../ui/PixelImage';
import { Btn, C } from '../ui/Btn';
import { ActionSheet, SheetAction } from '../ui/ActionSheet';
import { PreviewModal } from './AnimationEditorScreen';

interface Props {
  device: Backpack | null;
  linkUp: boolean;
  active: boolean;
  onOpen: (src: { kind: 'saved' | 'builtin'; id: string }) => void;
  onNew: () => void;
  onDevice: () => void;
}

const CARD_W = 150;

export function GalleryScreen({ device, linkUp, active, onOpen, onNew, onDevice }: Props) {
  const [list, setList] = useState<SavedAnimation[]>([]);
  const [preview, setPreview] = useState<SavedAnimation | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ anim: SavedAnimation; actions: SheetAction[] } | null>(null);
  const win = useWindowDimensions();
  const cols = Math.max(2, Math.floor((win.width - 24) / (CARD_W + 12)));
  const cardW = Math.floor((win.width - 24 - (cols - 1) * 12) / cols);

  useEffect(() => {
    if (!status || busy) return;
    const t = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(t);
  }, [status, busy]);

  const reload = useCallback(() => {
    AnimationStore.list().then(all =>
      setList([...all].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))));
  }, []);
  useEffect(() => { if (active) reload(); }, [active, reload]);

  const upload = useCallback(async (a: SavedAnimation) => {
    if (!device) { onDevice(); return; }
    setBusy(true);
    try {
      await uploadAnimation(device, a, setStatus);
      setStatus(`Uploaded "${a.name}".`);
    } catch (e: any) {
      setStatus('');
      Alert.alert('Upload failed', e.message);
    } finally {
      setBusy(false);
    }
  }, [device, onDevice]);

  const cardMenu = (a: SavedAnimation, builtin: boolean) => {
    const buttons: SheetAction[] = [
      { text: 'Edit', onPress: () => onOpen({ kind: builtin ? 'builtin' : 'saved', id: a.id }) },
      { text: 'Preview', onPress: () => setPreview(a) },
      { text: device ? 'Upload to backpack' : 'Connect backpack…', onPress: () => upload(a) },
    ];
    if (!builtin) {
      buttons.push({
        text: 'Duplicate',
        onPress: async () => {
          const now = Date.now();
          await AnimationStore.save({
            ...a, id: `anim_${now}_${Math.random().toString(36).slice(2, 7)}`,
            name: `${a.name} copy`, createdAt: now, updatedAt: now,
          });
          reload();
        },
      });
      buttons.push({
        text: 'Delete',
        destructive: true,
        onPress: () => Alert.alert('Delete', `Delete "${a.name}"?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { await AnimationStore.delete(a.id); reload(); } },
        ]),
      });
    }
    setMenu({ anim: a, actions: buttons });
  };

  const card = (a: SavedAnimation, builtin: boolean) => (
    <TouchableOpacity
      key={a.id}
      style={[styles.card, { width: cardW }]}
      onPress={() => onOpen({ kind: builtin ? 'builtin' : 'saved', id: a.id })}
      onLongPress={() => cardMenu(a, builtin)}
      activeOpacity={0.8}
    >
      <View style={styles.cardImg}>
        <PixelImage
          pixels={a.frames[0] ?? []}
          width={a.width}
          height={a.height}
          palette={a.palette}
          size={Math.min(130, (cardW - 20) * a.height / a.width)}
        />
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{a.name}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.cardMeta}>{a.frames.length} fr · {a.width}×{a.height}</Text>
        <TouchableOpacity onPress={() => cardMenu(a, builtin)} hitSlop={10}>
          <Text style={styles.cardDots}>⋯</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Pix Bag</Text>
        <TouchableOpacity style={styles.chip} onPress={onDevice}>
          <View style={[styles.dot, device ? (linkUp ? styles.dotOn : styles.dotLost) : styles.dotOff]} />
          <Text style={styles.chipText} numberOfLines={1}>
            {device ? (linkUp ? device.name : `${device.name} (link lost)`) : 'Connect backpack'}
          </Text>
        </TouchableOpacity>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionRow}>
          <Text style={styles.section}>My animations</Text>
          <Btn
            small
            label="Save"
            onPress={() => saveBackupToFile()
              .then(saved => { if (saved) setStatus('Backup saved.'); })
              .catch(e => Alert.alert('Save failed', e.message))}
          />
          <Btn small label="Share" onPress={() => shareBackup().catch(e => Alert.alert('Share failed', e.message))} />
          <Btn small label="⬇ Restore" onPress={() => Alert.alert('Restore', 'Merge with existing or replace all?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Merge', onPress: () => importWithAlerts('merge').then(reload) },
            { text: 'Replace all', style: 'destructive', onPress: () => importWithAlerts('replace').then(reload) },
          ])} />
        </View>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.card, styles.newCard, { width: cardW }]} onPress={onNew}>
            <Text style={styles.newPlus}>+</Text>
            <Text style={styles.cardName}>New animation</Text>
          </TouchableOpacity>
          {list.map(a => card(a, false))}
        </View>

        <Text style={[styles.section, styles.sectionGap]}>Built-in (tap to edit a copy)</Text>
        <View style={styles.grid}>
          {BUILTIN_ANIMATIONS.map(a => card(a, true))}
        </View>
      </ScrollView>

      {busy && <View style={styles.busy} pointerEvents="none"><Text style={styles.busyText}>Working…</Text></View>}
      {preview && <PreviewModal anim={preview} onClose={() => setPreview(null)} />}
      <ActionSheet
        title={menu?.anim.name ?? ''}
        subtitle={menu ? `${menu.anim.width}×${menu.anim.height} · ${menu.anim.frames.length} frame(s)` : ''}
        actions={menu?.actions ?? null}
        onClose={() => setMenu(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 10 },
  title:      { color: C.text, fontSize: 22, fontWeight: '800', flex: 1 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.btn, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border, maxWidth: 240 },
  chipText:   { color: C.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  dot:        { width: 10, height: 10, borderRadius: 5 },
  dotOn:      { backgroundColor: '#2ecc71' },
  dotOff:     { backgroundColor: '#666' },
  dotLost:    { backgroundColor: '#c0392b' },
  status:     { color: C.accent, fontSize: 12, paddingHorizontal: 14 },
  content:    { padding: 12, paddingBottom: 40 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  section:    { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
  sectionGap: { marginTop: 24, marginBottom: 10 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card:       { backgroundColor: C.panel, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#222' },
  cardImg:    { alignItems: 'center', justifyContent: 'center', height: 136, backgroundColor: '#000', borderRadius: 6 },
  cardName:   { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 6 },
  cardRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta:   { color: '#666', fontSize: 11 },
  cardDots:   { color: C.dim, fontSize: 18, paddingHorizontal: 4 },
  newCard:    { alignItems: 'center', justifyContent: 'center', minHeight: 190, borderStyle: 'dashed', borderColor: '#444' },
  newPlus:    { color: C.accent, fontSize: 48, fontWeight: '300' },
  busy:       { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#000c', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  busyText:   { color: C.accent },
});
