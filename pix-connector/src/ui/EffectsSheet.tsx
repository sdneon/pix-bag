import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Dir, EFFECTS, EffectKind, generateEffect, lightestColor } from '../editor/effects';
import { Frame } from '../editor/ops';
import { PixelGrid } from './PixelImage';
import { Slider } from './Slider';
import { Btn, C } from './Btn';

const USES_FRAMES: EffectKind[] = ['wave', 'slideIn', 'slideOut', 'bounceIn', 'grow', 'shrink', 'shake', 'wipe', 'dissolve', 'sparkle', 'rainbow'];
const USES_DIR: EffectKind[] = ['scrollImage', 'slideIn', 'slideOut', 'wipe'];
const DIRS: { key: Dir; label: string }[] = [
  { key: 'left', label: '←' }, { key: 'right', label: '→' }, { key: 'up', label: '↑' }, { key: 'down', label: '↓' },
];

// Pick an effect, tune it with a live preview, then add the generated frames.
export function EffectsSheet({ visible, initialKind, base, width, height, palette, color, onClose, onApply }: {
  visible: boolean;
  initialKind?: EffectKind;
  base: Frame;
  width: number;
  height: number;
  palette: string[];
  color: number;
  onClose: () => void;
  onApply: (frames: Frame[], durationMs: number, palette?: string[]) => void;
}) {
  const [kind, setKind] = useState<EffectKind>('scrollText');
  const [text, setText] = useState('HELLO');
  const [overImage, setOverImage] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [frames, setFrames] = useState(8);
  const [dir, setDir] = useState<Dir>('left');
  const [amp, setAmp] = useState(2);
  const [step, setStep] = useState(1);
  const [ms, setMs] = useState(100);
  const [mode, setMode] = useState<'in' | 'out'>('out');
  const [rainbowStyle, setRainbowStyle] = useState<'spiral' | 'swirl'>('swirl');
  const [whiteGaps, setWhiteGaps] = useState(false);
  const [waveStyle, setWaveStyle] = useState<'wave' | 'flame'>('wave');
  const [textColor, setTextColor] = useState(1);
  const [sparkColor, setSparkColor] = useState(1);
  const [tick, setTick] = useState(0);
  const pick = (k: EffectKind) => { setKind(k); setTick(0); setMode(k === 'dissolve' ? 'out' : 'in'); };
  useEffect(() => {
    if (!visible) return;
    if (initialKind) pick(initialKind);
    setTextColor(color || 1);
    setSparkColor(lightestColor(palette));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialKind]);

  const result = useMemo(
    () => (visible ? generateEffect(kind, base, width, height, {
      frames, text, textOverImage: overImage, textOnScreen: onScreen, step, dir, amp, mode, rainbowStyle, rainbowWhiteGaps: whiteGaps, palette, waveStyle,
      color: kind === 'sparkle' ? sparkColor : textColor,
    }) : { frames: [] }),
    [visible, kind, base, width, height, frames, text, overImage, onScreen, step, dir, amp, mode, rainbowStyle, whiteGaps, palette, waveStyle, sparkColor, textColor],
  );
  const out = result.frames;
  const pal = result.palette ?? palette;

  const swatches = (sel: number, set: (i: number) => void) => (
    <View style={s.row}>
      {palette.map((hex, i) => (i === 0 ? null : (
        <TouchableOpacity key={i} onPress={() => set(i)} style={[s.swatchRing, i === sel && s.swatchRingOn]}>
          <View style={[s.swatch, { backgroundColor: hex }]} />
        </TouchableOpacity>
      )))}
    </View>
  );

  useEffect(() => {
    if (!visible || out.length < 2) return;
    const id = setInterval(() => setTick(t => t + 1), Math.max(40, ms));
    return () => clearInterval(id);
  }, [visible, out.length, ms]);

  const shown = out.length ? out[tick % out.length] : base;
  const info = EFFECTS.find(e => e.kind === kind);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>Effects</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {EFFECTS.map(e => (
              <Btn key={e.kind} small label={e.label} active={kind === e.kind} onPress={() => pick(e.kind)} />
            ))}
          </ScrollView>
          <View style={s.body}>
            <View style={s.preview}>
              <PixelGrid pixels={shown} width={width} height={height} palette={pal} size={150} />
              <Text style={s.dim}>{out.length} frame{out.length === 1 ? '' : 's'}</Text>
            </View>
            <ScrollView style={s.opts} contentContainerStyle={{ gap: 6 }}>
              <Text style={s.dim}>{info?.hint}</Text>
              {kind === 'scrollText' && (
                <>
                  <TextInput
                    style={s.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Text"
                    placeholderTextColor="#555"
                    autoCapitalize="none"
                  />
                  <Text style={s.label}>Text colour</Text>
                  {swatches(textColor, setTextColor)}
                  <View style={s.row}>
                    <Btn small label={overImage ? 'Over image: on' : 'Over image: off'} active={overImage} onPress={() => setOverImage(v => !v)} />
                    <Btn small label={onScreen ? 'Start on screen' : 'Start off screen'} active={onScreen} onPress={() => setOnScreen(v => !v)} />
                  </View>
                  <Text style={s.dim}>Frames = text width{onScreen ? '' : ` + ${width}`} ÷ step (it scrolls fully off the left edge).</Text>
                </>
              )}
              {kind === 'sparkle' && (
                <>
                  <Text style={s.label}>Sparkle colour</Text>
                  {swatches(sparkColor, setSparkColor)}
                </>
              )}
              {(kind === 'dissolve' || kind === 'wipe') && (
                <View style={s.row}>
                  <Btn small label="Out (disappear)" active={mode === 'out'} onPress={() => setMode('out')} />
                  <Btn small label="In (appear)" active={mode === 'in'} onPress={() => setMode('in')} />
                </View>
              )}
              {kind === 'wave' && (
                <View style={s.row}>
                  <Btn small label="Wave" active={waveStyle === 'wave'} onPress={() => setWaveStyle('wave')} />
                  <Btn small label="Flame" active={waveStyle === 'flame'} onPress={() => setWaveStyle('flame')} />
                </View>
              )}
              {kind === 'rainbow' && (
                <View style={s.row}>
                  <Btn small label="Swirl" active={rainbowStyle === 'swirl'} onPress={() => setRainbowStyle('swirl')} />
                  <Btn small label="Spiral" active={rainbowStyle === 'spiral'} onPress={() => setRainbowStyle('spiral')} />
                  {rainbowStyle === 'swirl' && (
                    <Btn small label={whiteGaps ? 'Ring gaps: white' : 'Ring gaps: black'} active={whiteGaps} onPress={() => setWhiteGaps(v => !v)} />
                  )}
                </View>
              )}
              {USES_DIR.includes(kind) && (
                <View style={s.row}>
                  {DIRS.map(d => <Btn key={d.key} small label={d.label} active={dir === d.key} onPress={() => setDir(d.key)} />)}
                </View>
              )}
              {USES_FRAMES.includes(kind) && (
                <>
                  <Text style={s.label}>Frames: {frames}</Text>
                  <Slider value={frames} min={2} max={24} onChange={setFrames} />
                </>
              )}
              {(kind === 'wave' || kind === 'shake') && (
                <>
                  <Text style={s.label}>Strength: {amp}px</Text>
                  <Slider value={amp} min={1} max={4} onChange={setAmp} />
                </>
              )}
              {(kind === 'scrollText' || kind === 'scrollImage') && (
                <>
                  <Text style={s.label}>Step: {step}px per frame</Text>
                  <Slider value={step} min={1} max={4} onChange={setStep} />
                </>
              )}
              <Text style={s.label}>Speed: {ms} ms per frame</Text>
              <Slider value={ms} min={20} max={1000} step={10} onChange={setMs} />
            </ScrollView>
          </View>
          <View style={s.btns}>
            <Btn label="Cancel" onPress={onClose} />
            <Btn
              label={`Add ${out.length} frame${out.length === 1 ? '' : 's'}`}
              primary
              disabled={!out.length}
              onPress={() => onApply(out, ms, result.palette)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:   { backgroundColor: '#111', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 10, maxHeight: '75%', width: '100%', maxWidth: 720, alignSelf: 'center' },
  title:   { color: C.text, fontSize: 16, fontWeight: '700' },
  chips:   { gap: 6 },
  body:    { flexDirection: 'row', gap: 14, flexShrink: 1 },
  preview: { alignItems: 'center', gap: 4 },
  opts:    { flex: 1 },
  row:     { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  label:   { color: C.text, fontSize: 13 },
  dim:     { color: C.dim, fontSize: 12 },
  input:   { color: C.text, fontSize: 16, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  swatch:  { width: 26, height: 26, borderRadius: 5, borderWidth: 1, borderColor: '#555' },
  // Selected = cyan ring with a dark gap, visible whatever the swatch colour.
  swatchRing:   { padding: 2, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  swatchRingOn: { borderColor: C.accent },
  btns:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
