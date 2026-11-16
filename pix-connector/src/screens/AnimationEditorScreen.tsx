import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Backpack } from '../ble/Backpack';
import { uploadAnimation } from '../ble/upload';
import { AnimationStore, SavedAnimation, newAnimation } from '../storage/AnimationStore';
import { BUILTIN_ANIMATIONS } from '../data/builtinAnimations';
import * as ops from '../editor/ops';
import { PixelGrid, PixelImage } from '../ui/PixelImage';
import { ColorEditor } from '../ui/ColorEditor';
import { Slider } from '../ui/Slider';
import { Btn, C } from '../ui/Btn';

export type EditorSource =
  | { kind: 'new'; w: number; h: number }
  | { kind: 'saved'; id: string }
  | { kind: 'builtin'; id: string };

interface Props {
  source: EditorSource;
  device: Backpack | null;
  deviceSize: { w: number; h: number } | null;
  active: boolean;                 // top of the navigation stack
  onBack: () => void;
  onNeedDevice: () => void;
}

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'fill' | 'pick';
const TOOLS: { key: Tool; label: string }[] = [
  { key: 'pen', label: '✎ Pen' },
  { key: 'eraser', label: '⌫ Erase' },
  { key: 'line', label: '╱ Line' },
  { key: 'rect', label: '▭ Rect' },
  { key: 'fill', label: '◪ Fill' },
  { key: 'pick', label: '⊙ Pick' },
];

// Frame clipboard shared across editor instances (copy in one animation, paste in another).
let clipboard: { w: number; h: number; pixels: number[]; palette: string[] } | null = null;
const MAX_UNDO = 100;
const MAX_PALETTE = 16;
export const DIRECTIONS = ['Loop', 'Ping-pong', 'Play once', 'Ping-pong once'];

function copyOf(a: SavedAnimation): SavedAnimation {
  return {
    ...a,
    id: `anim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${a.name} copy`,
    palette: [...a.palette],
    frames: a.frames.map(f => [...f]),
    durations: [...a.durations],
    createdAt: Date.now(),
  };
}

export function AnimationEditorScreen({ source, device, deviceSize, active, onBack, onNeedDevice }: Props) {
  const [anim, setAnimState] = useState<SavedAnimation>(() =>
    source.kind === 'new' ? newAnimation(source.w, source.h) : newAnimation(16, 20));
  const [loaded, setLoaded] = useState(source.kind === 'new');
  const [sel, setSel] = useState(0);
  const [color, setColor] = useState(1);
  const [tool, setTool] = useState<Tool>('pen');
  const [onion, setOnion] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [editColor, setEditColor] = useState<number | null>(null);
  const [showDuration, setShowDuration] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [, setHistVer] = useState(0);

  const animRef = useRef(anim);
  const selRef = useRef(sel);
  const colorRef = useRef(color);
  const toolRef = useRef(tool);
  selRef.current = sel;
  colorRef.current = color;
  toolRef.current = tool;
  // Status toast clears itself unless a long operation is running.
  useEffect(() => {
    if (!status || busy) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status, busy]);
  const undoStack = useRef<SavedAnimation[]>([]);
  const redoStack = useRef<SavedAnimation[]>([]);

  // ── State helpers ───────────────────────────────────────────────────────────
  const setAnim = useCallback((next: SavedAnimation) => {
    animRef.current = next;
    setAnimState(next);
    setDirty(true);
  }, []);

  const pushUndo = useCallback(() => {
    undoStack.current.push(animRef.current);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setHistVer(v => v + 1);
  }, []);

  // Undoable change of the whole animation.
  const commit = useCallback((fn: (a: SavedAnimation) => SavedAnimation) => {
    const next = fn(animRef.current);
    if (next === animRef.current) return;
    pushUndo();
    setAnim(next);
  }, [pushUndo, setAnim]);

  // Undoable change of the selected frame.
  const commitFrame = useCallback((fn: (f: ops.Frame, a: SavedAnimation) => ops.Frame) => {
    commit(a => {
      const fi = selRef.current;
      const f = fn(a.frames[fi], a);
      if (f === a.frames[fi]) return a;
      const frames = [...a.frames];
      frames[fi] = f;
      return { ...a, frames };
    });
  }, [commit]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(animRef.current);
    setAnim(prev);
    setSel(s => Math.min(s, prev.frames.length - 1));
    setHistVer(v => v + 1);
  }, [setAnim]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(animRef.current);
    setAnim(next);
    setSel(s => Math.min(s, next.frames.length - 1));
    setHistVer(v => v + 1);
  }, [setAnim]);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let a: SavedAnimation | null = null;
      if (source.kind === 'saved') a = await AnimationStore.get(source.id);
      if (source.kind === 'builtin') {
        const b = BUILTIN_ANIMATIONS.find(x => x.id === source.id);
        if (b) a = copyOf(b);
      }
      if (cancelled || !a) { setLoaded(true); return; }
      animRef.current = a;
      setAnimState(a);
      setDirty(source.kind === 'builtin');
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [source]);

  // ── Layout ──────────────────────────────────────────────────────────────────
  const win = useWindowDimensions();
  const wide = win.width > win.height * 1.05;
  const narrow = win.width < 480;
  const [gridArea, setGridArea] = useState({ w: 0, h: 0 });
  const cellSize = useMemo(() => {
    const aw = (gridArea.w || win.width) - 12;
    const ah = (gridArea.h || win.height / 2) - 12;
    return Math.max(4, Math.floor(Math.min(aw / anim.width, ah / anim.height)));
  }, [gridArea, win.width, win.height, anim.width, anim.height]);
  const cellRef = useRef(cellSize);
  cellRef.current = cellSize;

  // ── Painting ────────────────────────────────────────────────────────────────
  const gridRef = useRef<View>(null);
  const gridOrigin = useRef({ x: 0, y: 0 });
  const lastCell = useRef<[number, number] | null>(null);
  const shape = useRef<{ start: [number, number]; base: number[] } | null>(null);

  // Line/rect preview: redraw the shape over the frame as it was at touch-down.
  const drawShape = (end: [number, number]) => {
    const s = shape.current;
    if (!s) return;
    const a = animRef.current;
    const [x0, y0] = s.start;
    const cells = toolRef.current === 'rect'
      ? ops.rectCells(x0, y0, end[0], end[1])
      : ops.lineCells(x0, y0, end[0], end[1]);
    const next = [...s.base];
    for (const [x, y] of cells) next[y * a.width + x] = colorRef.current;
    const frames = [...a.frames];
    frames[selRef.current] = next;
    setAnim({ ...a, frames });
  };

  const cellAt = (pageX: number, pageY: number): [number, number] | null => {
    const a = animRef.current;
    const cs = cellRef.current;
    const x = Math.floor((pageX - gridOrigin.current.x) / cs);
    const y = Math.floor((pageY - gridOrigin.current.y) / cs);
    return x < 0 || y < 0 || x >= a.width || y >= a.height ? null : [x, y];
  };

  const paintCells = (cells: [number, number][], c: number) => {
    const a = animRef.current;
    const fi = selRef.current;
    const f = a.frames[fi];
    let next: number[] | null = null;
    for (const [x, y] of cells) {
      const i = y * a.width + x;
      if ((next ?? f)[i] !== c) {
        if (!next) next = [...f];
        next[i] = c;
      }
    }
    if (!next) return;
    const frames = [...a.frames];
    frames[fi] = next;
    setAnim({ ...a, frames });
  };

  const onDown = (pageX: number, pageY: number) => {
    const cell = cellAt(pageX, pageY);
    lastCell.current = cell;
    if (!cell) return;
    const a = animRef.current;
    const [x, y] = cell;
    switch (toolRef.current) {
      case 'pick':
        setColor(a.frames[selRef.current][y * a.width + x]);
        setTool('pen');
        lastCell.current = null;
        return;
      case 'fill':
        commitFrame(f => ops.floodFill(f, a.width, a.height, x, y, colorRef.current));
        lastCell.current = null;
        return;
      case 'line':
      case 'rect':
        pushUndo();
        shape.current = { start: cell, base: a.frames[selRef.current] };
        drawShape(cell);
        return;
      default:
        pushUndo();
        paintCells([cell], toolRef.current === 'eraser' ? 0 : colorRef.current);
    }
  };

  const onMove = (pageX: number, pageY: number) => {
    if (!lastCell.current) return;
    const cell = cellAt(pageX, pageY);
    if (!cell) return;
    const [lx, ly] = lastCell.current;
    if (lx === cell[0] && ly === cell[1]) return;
    if (shape.current) { drawShape(cell); lastCell.current = cell; return; }
    paintCells(ops.lineCells(lx, ly, cell[0], cell[1]), toolRef.current === 'eraser' ? 0 : colorRef.current);
    lastCell.current = cell;
  };

  const handlers = useRef({ onDown, onMove });
  handlers.current = { onDown, onMove };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: evt => {
      const { pageX, pageY } = evt.nativeEvent;
      gridRef.current?.measure((_x, _y, _w, _h, px, py) => {
        gridOrigin.current = { x: px, y: py };
        handlers.current.onDown(pageX, pageY);
      });
    },
    onPanResponderMove: evt => handlers.current.onMove(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
    onPanResponderRelease: () => { lastCell.current = null; shape.current = null; },
  })).current;

  // ── Frames ──────────────────────────────────────────────────────────────────
  const addFrame = () => {
    commit(a => {
      const frames = [...a.frames];
      const durations = [...a.durations];
      frames.splice(sel + 1, 0, ops.blankFrame(a.width, a.height));
      durations.splice(sel + 1, 0, a.durations[sel] ?? 500);
      return { ...a, frames, durations };
    });
    setSel(sel + 1);
  };
  const dupFrame = () => {
    commit(a => {
      const frames = [...a.frames];
      const durations = [...a.durations];
      frames.splice(sel + 1, 0, [...a.frames[sel]]);
      durations.splice(sel + 1, 0, a.durations[sel] ?? 500);
      return { ...a, frames, durations };
    });
    setSel(sel + 1);
  };
  const delFrame = () => {
    if (anim.frames.length <= 1) {
      commitFrame((_f, a) => ops.blankFrame(a.width, a.height));
      return;
    }
    commit(a => ({
      ...a,
      frames: a.frames.filter((_, i) => i !== sel),
      durations: a.durations.filter((_, i) => i !== sel),
    }));
    setSel(Math.max(0, sel - 1));
  };
  const moveFrame = (d: number) => {
    const to = sel + d;
    if (to < 0 || to >= anim.frames.length) return;
    commit(a => {
      const frames = [...a.frames];
      const durations = [...a.durations];
      [frames[sel], frames[to]] = [frames[to], frames[sel]];
      [durations[sel], durations[to]] = [durations[to], durations[sel]];
      return { ...a, frames, durations };
    });
    setSel(to);
  };

  const copyFrame = () => {
    clipboard = { w: anim.width, h: anim.height, pixels: [...anim.frames[sel]], palette: [...anim.palette] };
    setStatus('Frame copied.');
  };
  // Paste maps colours: same hex → same slot, else add to palette, else nearest colour.
  const pasteFrame = () => {
    const cb = clipboard;
    if (!cb) return;
    commit(a => {
      const palette = [...a.palette];
      const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
      const map = cb.palette.map(hex => {
        const i = palette.findIndex(p => p.toLowerCase() === hex.toLowerCase());
        if (i >= 0) return i;
        if (palette.length < MAX_PALETTE) { palette.push(hex); return palette.length - 1; }
        const [r, g, b] = rgb(hex);
        let best = 0, bd = Infinity;
        palette.forEach((p, j) => {
          const [pr, pg, pb] = rgb(p);
          const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
          if (d < bd) { bd = d; best = j; }
        });
        return best;
      });
      const f = ops.blankFrame(a.width, a.height);
      for (let y = 0; y < Math.min(a.height, cb.h); y++) {
        for (let x = 0; x < Math.min(a.width, cb.w); x++) f[y * a.width + x] = map[cb.pixels[y * cb.w + x]] ?? 0;
      }
      const frames = [...a.frames];
      frames[sel] = f;
      return { ...a, palette, frames };
    });
  };

  // ── Palette ─────────────────────────────────────────────────────────────────
  const addPaletteColor = () => {
    if (anim.palette.length >= MAX_PALETTE) return;
    commit(a => ({ ...a, palette: [...a.palette, '#ffffff'] }));
    setEditColor(anim.palette.length);
  };

  // ── Save / upload ───────────────────────────────────────────────────────────
  const save = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const a = { ...animRef.current, updatedAt: Date.now() };
      await AnimationStore.save(a);
      animRef.current = a;
      setAnimState(a);
      setDirty(false);
      setStatus('Saved.');
      return true;
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const doUpload = useCallback(async () => {
    if (!device) {
      Alert.alert('No backpack connected', 'Connect to your backpack first.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Connect', onPress: onNeedDevice },
      ]);
      return;
    }
    const a = animRef.current;
    const go = async () => {
      setBusy(true);
      setStatus('Uploading…');
      try {
        await uploadAnimation(device, a, setStatus);
        setStatus('Uploaded!');
      } catch (e: any) {
        setStatus(`Upload failed: ${e.message}`);
        Alert.alert('Upload failed', e.message);
      } finally {
        setBusy(false);
      }
    };
    if (deviceSize && (deviceSize.w !== a.width || deviceSize.h !== a.height)) {
      Alert.alert(
        'Size mismatch',
        `This animation is ${a.width}×${a.height} but the backpack is ${deviceSize.w}×${deviceSize.h}. Upload anyway?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Upload', onPress: go }],
      );
    } else {
      go();
    }
  }, [device, deviceSize, onNeedDevice]);

  const requestBack = useCallback(() => {
    if (!dirty) { onBack(); return; }
    Alert.alert('Unsaved changes', 'Save before leaving?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onBack },
      { text: 'Save', onPress: async () => { if (await save()) onBack(); } },
    ]);
  }, [dirty, onBack, save]);

  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { requestBack(); return true; });
    return () => sub.remove();
  }, [active, requestBack]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const frame = anim.frames[sel] ?? [];
  const prevFrame = onion && sel > 0 ? anim.frames[sel - 1] : null;
  const gridW = cellSize * anim.width;
  const gridH = cellSize * anim.height;
  const gap = cellSize >= 12 ? 1 : 0;

  const cells = useMemo(() => frame.map((ci, i) => {
    const onionCi = prevFrame && ci === 0 ? prevFrame[i] : 0;
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: (i % anim.width) * cellSize,
          top: Math.floor(i / anim.width) * cellSize,
          width: cellSize - gap,
          height: cellSize - gap,
          backgroundColor: ci ? anim.palette[ci] ?? '#000' : '#161616',
        }}
      >
        {onionCi ? (
          <View style={{ flex: 1, backgroundColor: anim.palette[onionCi], opacity: 0.3 }} />
        ) : null}
      </View>
    );
  }), [frame, prevFrame, anim.palette, anim.width, cellSize, gap]);

  const toolsRow = (
    <View style={styles.toolRow}>
      {TOOLS.map(t => (
        <Btn key={t.key} small label={t.label} active={tool === t.key} onPress={() => setTool(t.key)} />
      ))}
      <View style={styles.sep} />
      <Btn small label="Undo" onPress={undo} disabled={!undoStack.current.length} />
      <Btn small label="Redo" onPress={redo} disabled={!redoStack.current.length} />
      <Btn small label="More…" onPress={() => setShowMenu(true)} />
    </View>
  );

  const paletteRow = (
    <View style={styles.palette}>
      {anim.palette.map((hex, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => { setColor(i); if (tool === 'eraser' || tool === 'pick') setTool('pen'); }}
          onLongPress={() => setEditColor(i)}
          style={[styles.swatch, { backgroundColor: hex }, i === color && styles.swatchActive]}
        />
      ))}
      {anim.palette.length < MAX_PALETTE && (
        <TouchableOpacity onPress={addPaletteColor} style={[styles.swatch, styles.swatchAdd]}>
          <Text style={styles.swatchAddText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const framesStrip = (
    <View>
      <Text style={styles.label}>
        Frame {sel + 1}/{anim.frames.length} · {anim.width}×{anim.height} · {DIRECTIONS[anim.animationDirection ?? 0]}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {anim.frames.map((f, i) => (
          <TouchableOpacity key={i} onPress={() => setSel(i)} style={[styles.thumb, i === sel && styles.thumbActive]}>
            <PixelImage pixels={f} width={anim.width} height={anim.height} palette={anim.palette} size={52} />
            <Text style={styles.thumbNum}>{i + 1}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={addFrame} style={[styles.thumb, styles.thumbAdd]}>
          <Text style={styles.thumbAddText}>+</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={styles.toolRow}>
        <Btn small label="+ New" onPress={addFrame} />
        <Btn small label="Dup" onPress={dupFrame} />
        <Btn small label="◀" onPress={() => moveFrame(-1)} disabled={sel === 0} />
        <Btn small label="▶" onPress={() => moveFrame(1)} disabled={sel >= anim.frames.length - 1} />
        <Btn small label={`⏱ ${anim.durations[sel] ?? 500}ms`} onPress={() => setShowDuration(true)} />
        <Btn small danger label="Del" onPress={delFrame} />
      </View>
    </View>
  );

  if (!loaded) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={requestBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.nameInput}
          value={anim.name}
          onChangeText={name => setAnim({ ...animRef.current, name })}
          placeholder="Animation name"
          placeholderTextColor="#555"
        />
        <Btn small label={narrow ? '▶' : '▶ Play'} onPress={() => setShowPreview(true)} />
        <Btn small label={dirty ? 'Save •' : 'Save'} onPress={save} disabled={busy} primary={dirty} />
        <Btn small label={busy ? '…' : narrow ? '⇪' : '⇪ Upload'} onPress={doUpload} disabled={busy} primary />
      </View>
      <View style={[styles.body, wide && styles.bodyWide]}>
        {!wide && <View style={styles.panelTop}>{toolsRow}{paletteRow}</View>}
        <View
          style={styles.gridArea}
          onLayout={e => setGridArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          <View
            ref={gridRef}
            collapsable={false}
            style={{ width: gridW, height: gridH, backgroundColor: '#000' }}
            {...pan.panHandlers}
          >
            {cells}
          </View>
        </View>
        {wide ? (
          <ScrollView style={styles.side} contentContainerStyle={styles.sideContent}>
            {toolsRow}
            {paletteRow}
            {framesStrip}
          </ScrollView>
        ) : (
          <View style={styles.panelBottom}>{framesStrip}</View>
        )}
      </View>

      <ColorEditor
        visible={editColor !== null}
        color={editColor !== null ? anim.palette[editColor] ?? '#ffffff' : '#ffffff'}
        onCancel={() => setEditColor(null)}
        onDone={hex => {
          const idx = editColor!;
          commit(a => {
            const palette = [...a.palette];
            palette[idx] = hex;
            return { ...a, palette };
          });
          setColor(idx);
          setEditColor(null);
        }}
      />

      <DurationModal
        visible={showDuration}
        value={anim.durations[sel] ?? 500}
        onClose={() => setShowDuration(false)}
        onApply={(ms, all) => {
          commit(a => {
            const durations = all ? a.durations.map(() => ms) : [...a.durations];
            durations[sel] = ms;
            return { ...a, durations };
          });
          setShowDuration(false);
        }}
      />

      <FrameMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onion={onion}
        direction={anim.animationDirection ?? 0}
        onToggleOnion={() => setOnion(o => !o)}
        onCopy={copyFrame}
        onPaste={clipboard ? pasteFrame : undefined}
        onDirection={d => commit(a => ({ ...a, animationDirection: d }))}
        onOp={op => commitFrame((f, a) => {
          const { width: w, height: h } = a;
          switch (op) {
            case 'flipH': return ops.flipH(f, w, h);
            case 'flipV': return ops.flipV(f, w, h);
            case 'left': return ops.shift(f, w, h, -1, 0);
            case 'right': return ops.shift(f, w, h, 1, 0);
            case 'up': return ops.shift(f, w, h, 0, -1);
            case 'down': return ops.shift(f, w, h, 0, 1);
            case 'clear': return ops.blankFrame(w, h);
            default: return f;
          }
        })}
      />

      {showPreview && <PreviewModal anim={anim} onClose={() => setShowPreview(false)} />}
      {status ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{status}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Frame duration ─────────────────────────────────────────────────────────────

const DURATION_PRESETS = [50, 100, 200, 300, 500, 1000, 2000];

function DurationModal({ visible, value, onClose, onApply }: {
  visible: boolean;
  value: number;
  onClose: () => void;
  onApply: (ms: number, all: boolean) => void;
}) {
  const [ms, setMs] = useState(value);
  useEffect(() => { if (visible) setMs(value); }, [visible, value]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.box}>
          <Text style={modal.title}>Frame duration: {ms} ms</Text>
          <Slider value={ms} min={20} max={3000} step={10} onChange={setMs} />
          <View style={modal.wrap}>
            {DURATION_PRESETS.map(p => (
              <Btn key={p} small label={`${p}`} active={p === ms} onPress={() => setMs(p)} />
            ))}
          </View>
          <View style={modal.btns}>
            <Btn label="Cancel" onPress={onClose} />
            <Btn label="All frames" onPress={() => onApply(ms, true)} />
            <Btn label="This frame" primary onPress={() => onApply(ms, false)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Frame tools menu ───────────────────────────────────────────────────────────

type FrameOp = 'flipH' | 'flipV' | 'left' | 'right' | 'up' | 'down' | 'clear';

function FrameMenu({ visible, onClose, onion, direction, onToggleOnion, onCopy, onPaste, onDirection, onOp }: {
  visible: boolean;
  onClose: () => void;
  onion: boolean;
  direction: number;
  onToggleOnion: () => void;
  onCopy: () => void;
  onPaste?: () => void;
  onDirection: (d: number) => void;
  onOp: (op: FrameOp) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.box}>
          <Text style={modal.title}>Frame tools</Text>
          <View style={modal.wrap}>
            <Btn small label="⇋ Flip H" onPress={() => onOp('flipH')} />
            <Btn small label="⇵ Flip V" onPress={() => onOp('flipV')} />
            <Btn small label="Clear frame" danger onPress={() => onOp('clear')} />
          </View>
          <View style={modal.wrap}>
            <Btn small label="Copy frame" onPress={onCopy} />
            <Btn small label="Paste into frame" onPress={() => onPaste?.()} disabled={!onPaste} />
          </View>
          <Text style={modal.sub}>Shift (wraps around)</Text>
          <View style={modal.wrap}>
            <Btn small label="←" onPress={() => onOp('left')} />
            <Btn small label="→" onPress={() => onOp('right')} />
            <Btn small label="↑" onPress={() => onOp('up')} />
            <Btn small label="↓" onPress={() => onOp('down')} />
          </View>
          <Text style={modal.sub}>Playback</Text>
          <View style={modal.wrap}>
            {DIRECTIONS.map((d, i) => (
              <Btn key={d} small label={d} active={direction === i} onPress={() => onDirection(i)} />
            ))}
          </View>
          <Text style={modal.sub}>View</Text>
          <View style={modal.wrap}>
            <Btn small label={onion ? 'Onion skin: on' : 'Onion skin: off'} active={onion} onPress={onToggleOnion} />
          </View>
          <View style={modal.btns}>
            <Btn label="Done" primary onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Animation preview ──────────────────────────────────────────────────────────

export function PreviewModal({ anim, onClose }: { anim: SavedAnimation; onClose: () => void }) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [stopped, setStopped] = useState(false);
  const pingPongDir = useRef(1); // +1 forward, -1 backward
  const win = useWindowDimensions();

  const dir = anim.animationDirection ?? 0;
  const total = anim.frames.length;

  useEffect(() => {
    if (!playing || stopped || total <= 1) return;
    const id = setTimeout(() => {
      let next = frameIdx;
      let done = false;
      switch (dir) {
        case 1:
          next = frameIdx + pingPongDir.current;
          if (next >= total) { pingPongDir.current = -1; next = Math.max(0, total - 2); }
          else if (next < 0) { pingPongDir.current = 1; next = Math.min(total - 1, 1); }
          break;
        case 2:
          if (frameIdx >= total - 1) done = true; else next = frameIdx + 1;
          break;
        case 3:
          next = frameIdx + pingPongDir.current;
          if (next >= total) { pingPongDir.current = -1; next = Math.max(0, total - 2); }
          else if (next < 0) { done = true; next = 0; }
          break;
        default:
          next = (frameIdx + 1) % total;
      }
      if (done) setStopped(true); else setFrameIdx(next);
    }, anim.durations[frameIdx] ?? 500);
    return () => clearTimeout(id);
  }, [frameIdx, playing, stopped, total, dir, anim.durations]);

  const restart = () => { pingPongDir.current = 1; setFrameIdx(0); setStopped(false); setPlaying(true); };
  const h = Math.min(win.height - 240, ((win.width - 80) * anim.height) / anim.width);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={[modal.box, { alignItems: 'center', width: undefined }]}>
          <Text style={modal.title}>{anim.name}</Text>
          <PixelGrid
            pixels={anim.frames[frameIdx] ?? []}
            width={anim.width}
            height={anim.height}
            palette={anim.palette}
            size={h}
          />
          <Text style={modal.sub}>Frame {frameIdx + 1} / {total}{stopped ? ' · done' : ''}</Text>
          <View style={modal.btns}>
            {stopped
              ? <Btn label="↺ Restart" onPress={restart} />
              : <Btn label={playing ? '⏸ Pause' : '▶ Play'} onPress={() => setPlaying(p => !p)} />}
            <Btn label="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6 },
  backBtn:       { paddingHorizontal: 8, paddingVertical: 4 },
  backText:      { color: C.accent, fontSize: 22 },
  nameInput:     { flex: 1, color: C.text, fontSize: 16, fontWeight: '700', borderBottomWidth: 1, borderColor: C.border, paddingVertical: 3, minWidth: 80 },
  toast:         { position: 'absolute', top: 56, alignSelf: 'center', backgroundColor: '#000d', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#234' },
  toastText:     { color: C.accent, fontSize: 13 },
  body:          { flex: 1 },
  bodyWide:      { flexDirection: 'row' },
  panelTop:      { paddingHorizontal: 10, gap: 6, paddingBottom: 4 },
  panelBottom:   { paddingHorizontal: 10, paddingBottom: 8 },
  gridArea:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  side:          { width: 360, flexGrow: 0, borderLeftWidth: 1, borderColor: '#1e1e1e' },
  sideContent:   { padding: 10, gap: 10 },
  toolRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  sep:           { width: 6 },
  palette:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch:        { width: 34, height: 34, borderRadius: 6, borderWidth: 2, borderColor: '#2a2a2a' },
  swatchActive:  { borderColor: '#fff', borderWidth: 3 },
  swatchAdd:     { backgroundColor: C.btn, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: '#555' },
  swatchAddText: { color: C.dim, fontSize: 18 },
  label:         { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6, marginBottom: 6 },
  strip:         { gap: 6, paddingBottom: 6, alignItems: 'center' },
  thumb:         { padding: 3, borderRadius: 6, borderWidth: 2, borderColor: '#2a2a2a', alignItems: 'center', backgroundColor: '#111' },
  thumbActive:   { borderColor: C.accent },
  thumbNum:      { color: C.dim, fontSize: 10, marginTop: 1 },
  thumbAdd:      { width: 50, height: 72, justifyContent: 'center', borderStyle: 'dashed', borderColor: '#555' },
  thumbAddText:  { color: C.dim, fontSize: 24 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  box:     { backgroundColor: '#111', borderRadius: 16, padding: 20, width: 420, maxWidth: '92%', gap: 8 },
  title:   { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sub:     { color: C.dim, fontSize: 12, marginTop: 6 },
  wrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btns:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
