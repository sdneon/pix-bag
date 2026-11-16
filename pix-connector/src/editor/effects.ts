// Animation generators: each turns one frame (plus options) into a list of new frames.

import { Frame, blankFrame, shift } from './ops';
import { FONT_B64 } from '../ble/font';

export type EffectKind =
  | 'scrollText' | 'scrollImage' | 'wave' | 'slideIn' | 'slideOut' | 'bounceIn'
  | 'grow' | 'shrink' | 'blink' | 'colorCycle' | 'shake'
  | 'wipe' | 'dissolve' | 'sparkle' | 'heartbeat' | 'rainbow';

export type Dir = 'left' | 'right' | 'up' | 'down';

export interface EffectOptions {
  frames: number;          // ignored where the effect fixes its own length
  text?: string;
  color?: number;          // palette index for text / sparkles
  textOverImage?: boolean; // scroll text over the base frame instead of blank
  textOnScreen?: boolean;  // text starts already on screen (skips the run-in from the edge)
  step?: number;           // pixels per frame (scrolling)
  dir?: Dir;
  amp?: number;            // wave/shake amplitude in pixels
  waveRows?: 'top' | 'all';
  waveStyle?: 'wave' | 'flame'; // wave: whole image leans like a tree in the wind; flame: S-ripple of the top half
  mode?: 'in' | 'out';     // wipe/dissolve: appear or disappear
  rainbowStyle?: 'spiral' | 'swirl';
  rainbowWhiteGaps?: boolean; // swirl: the rings' empty segments are white instead of background
  palette?: string[];      // needed by effects that add colours (rainbow)
}

export interface EffectResult {
  frames: Frame[];
  palette?: string[];      // set when the effect added colours
}

export const MAX_PALETTE = 16;

export const EFFECTS: { kind: EffectKind; label: string; hint: string }[] = [
  { kind: 'scrollText', label: 'Scroll text', hint: 'Your text scrolls across the display' },
  { kind: 'wave', label: 'Wave', hint: 'Wave: sways like a tree in the wind. Flame: top half ripples like fire' },
  { kind: 'scrollImage', label: 'Scroll image', hint: 'Image loops round the screen' },
  { kind: 'slideIn', label: 'Slide in', hint: 'Image slides in from an edge' },
  { kind: 'slideOut', label: 'Slide out', hint: 'Image slides out to an edge' },
  { kind: 'bounceIn', label: 'Bounce in', hint: 'Drops in from the top and bounces' },
  { kind: 'grow', label: 'Grow', hint: 'Zooms in from the centre' },
  { kind: 'shrink', label: 'Shrink', hint: 'Zooms out to the centre' },
  { kind: 'blink', label: 'Blink', hint: 'On / off' },
  { kind: 'colorCycle', label: 'Colour cycle', hint: 'Each colour in the image passes to the next one every frame, like chasing lights' },
  { kind: 'shake', label: 'Shake', hint: 'Quick jiggle' },
  { kind: 'wipe', label: 'Wipe', hint: 'Image appears / disappears line by line' },
  { kind: 'dissolve', label: 'Dissolve', hint: 'Image breaks up (or builds up) pixel by pixel' },
  { kind: 'sparkle', label: 'Sparkle', hint: 'Little stars twinkle around the image' },
  { kind: 'heartbeat', label: 'Heartbeat', hint: 'Double pulse, like a heartbeat' },
  { kind: 'rainbow', label: 'Rainbow', hint: 'Spiral: rainbow bands spin behind the image. Swirl: two rainbow rings spin round it (adds rainbow colours to the palette)' },
];

const RAINBOW = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0080ff', '#8000ff'];

const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// Palette indices for the wanted colours: reuse exact matches, add while there is room, else nearest.
export function withColors(palette: string[], wanted: string[]): { palette: string[]; idx: number[] } {
  const pal = [...palette];
  const idx = wanted.map(hex => {
    const i = pal.findIndex(p => p.toLowerCase() === hex.toLowerCase());
    if (i >= 0) return i;
    if (pal.length < MAX_PALETTE) { pal.push(hex); return pal.length - 1; }
    const [r, g, b] = rgb(hex);
    let best = 1, bd = Infinity;
    pal.forEach((p, j) => {
      if (j === 0) return; // index 0 is the background
      const [pr, pg, pb] = rgb(p);
      const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (d < bd) { bd = d; best = j; }
    });
    return best;
  });
  return { palette: pal, idx };
}

// Brightest non-background palette entry (default sparkle colour).
export function lightestColor(palette: string[]): number {
  let best = 1, bl = -1;
  palette.forEach((p, i) => {
    if (i === 0) return;
    const [r, g, b] = rgb(p);
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    if (l > bl) { bl = l; best = i; }
  });
  return best;
}

// Small deterministic PRNG so previews and results match.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shift without wrap; uncovered pixels are blank.
export function offset(f: Frame, w: number, h: number, dx: number, dy: number): Frame {
  const out = blankFrame(w, h);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      if (sx >= 0 && sx < w) out[y * w + x] = f[sy * w + sx];
    }
  }
  return out;
}

// Nearest-neighbour scale about the centre (s=1 → unchanged, s→0 → blank).
export function scale(f: Frame, w: number, h: number, s: number): Frame {
  const out = blankFrame(w, h);
  if (s <= 0.01) return out;
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(cy + (y + 0.5 - cy) / s);
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(cx + (x + 0.5 - cx) / s);
      if (sx >= 0 && sx < w) out[y * w + x] = f[sy * w + sx];
    }
  }
  return out;
}

// ── Text ───────────────────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function glyphRows(ch: string): number[] | null {
  const s = FONT_B64[ch];
  if (!s) return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => Math.max(0, B64.indexOf(s[i + k])));
    out.push((n[0] << 2) | (n[1] >> 4));
    if (s[i + 2] !== '=') out.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (s[i + 3] !== '=') out.push(((n[2] & 3) << 6) | n[3]);
  }
  return out.slice(0, 20);
}

// Text rendered as columns (each column = 20 bits, row 0 at bit 0), 1px gap between glyphs.
export function textColumns(text: string): number[] {
  const cols: number[] = [];
  for (const ch of text) {
    const rows = glyphRows(ch) ?? glyphRows('?');
    if (!rows) continue;
    const glyph: number[] = [];
    for (let x = 0; x < 8; x++) {
      let col = 0;
      rows.forEach((r, y) => { if ((r >> x) & 1) col |= 1 << y; });
      glyph.push(col);
    }
    let a = glyph.findIndex(c => c !== 0);
    let b = 7 - [...glyph].reverse().findIndex(c => c !== 0);
    if (a < 0) { a = 0; b = 2; } // space
    cols.push(...glyph.slice(a, b + 1), 0);
  }
  return cols;
}

export function isTextSupported(ch: string): boolean {
  return ch in FONT_B64;
}

function scrollText(base: Frame, w: number, h: number, o: EffectOptions): Frame[] {
  const cols = textColumns(o.text ?? '');
  if (!cols.length) return [];
  const step = Math.max(1, o.step ?? 1);
  const color = o.color ?? 1;
  const top = Math.floor((h - 20) / 2);
  // Runs in from the right edge (unless on-screen start) and out past the left edge.
  const strip = [...new Array(o.textOnScreen ? 0 : w).fill(0), ...cols, ...new Array(w).fill(0)];
  const frames: Frame[] = [];
  for (let s = 0; s + w <= strip.length; s += step) {
    const f = o.textOverImage ? [...base] : blankFrame(w, h);
    for (let x = 0; x < w; x++) {
      const col = strip[s + x];
      if (!col) continue;
      for (let r = 0; r < 20; r++) {
        const y = top + r;
        if ((col >> r) & 1 && y >= 0 && y < h) f[y * w + x] = color;
      }
    }
    frames.push(f);
  }
  return frames;
}

// ── Motion ─────────────────────────────────────────────────────────────────────

const dirVec = (d: Dir): [number, number] =>
  d === 'left' ? [-1, 0] : d === 'right' ? [1, 0] : d === 'up' ? [0, -1] : [0, 1];

function easeOutBounce(t: number): number {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

// Image rocks as one piece around the middle of its bottom edge (like a hand at the wrist or a tree
// in the wind): the top travels furthest, the base stays put. Strength = 5 degrees per step.
function sway(base: Frame, w: number, h: number, o: EffectOptions): Frame[] {
  const n = Math.max(2, o.frames);
  const maxAngle = ((o.amp ?? 2) * 5 * Math.PI) / 180;
  let left = w, right = -1, bottom = -1;
  base.forEach((c, p) => {
    if (!c) return;
    const x = p % w, y = (p / w) | 0;
    left = Math.min(left, x); right = Math.max(right, x); bottom = Math.max(bottom, y);
  });
  if (bottom < 0) return Array.from({ length: n }, () => [...base]);
  const px = (left + right + 1) / 2, py = bottom + 1;
  return Array.from({ length: n }, (_, t) => {
    const a = maxAngle * Math.sin((2 * Math.PI * t) / n);
    const cos = Math.cos(a), sin = Math.sin(a);
    const f = blankFrame(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - px, dy = y + 0.5 - py;
        const sx = Math.floor(px + dx * cos + dy * sin);
        const sy = Math.floor(py - dx * sin + dy * cos);
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) f[y * w + x] = base[sy * w + sx];
      }
    }
    return f;
  });
}

function wave(base: Frame, w: number, h: number, o: EffectOptions): Frame[] {
  if (o.waveStyle !== 'flame') return sway(base, w, h, o);
  const n = Math.max(2, o.frames);
  const amp = o.amp ?? 1;
  const mid = Math.ceil(h / 2);
  const fade = 4; // rows below the middle over which the sway dies out
  const rows = o.waveRows === 'all' ? h : Math.min(h, mid + fade);
  const frames: Frame[] = [];
  for (let t = 0; t < n; t++) {
    const f = [...base];
    for (let y = 0; y < rows; y++) {
      // Top half sways fully; just below the middle it eases off to still.
      const weight = o.waveRows === 'all' || y < mid ? 1 : 1 - (y - mid + 1) / (fade + 1);
      const dx = Math.round(amp * weight * Math.sin((2 * Math.PI * t) / n + y * 0.6));
      for (let x = 0; x < w; x++) {
        const sx = x - dx;
        f[y * w + x] = sx >= 0 && sx < w ? base[y * w + sx] : 0;
      }
    }
    frames.push(f);
  }
  return frames;
}

// Rainbow behind the image (empty pixels only). Spiral: bands spiralling round the centre.
// Swirl: two counter-rotating rainbow arcs (outer red/yellow/green clockwise, inner blue/purple
// anticlockwise at twice the speed). Both loop cleanly over n frames.
function rainbow(base: Frame, w: number, h: number, o: EffectOptions): EffectResult {
  const n = Math.max(2, Math.round(o.frames));
  const { palette, idx } = withColors(o.palette ?? ['#000000'], RAINBOW);
  const k = idx.length;
  const cx = (w - 1) / 2, cy = (h - 1) / 2, rmax = Math.hypot(cx, cy) || 1;
  if (o.rainbowStyle === 'swirl') {
    const [red, , yellow, green, blue, purple] = idx;
    let pal = palette, gap = 0;
    if (o.rainbowWhiteGaps) {
      const w2 = withColors(palette, ['#ffffff']);
      pal = w2.palette; gap = w2.idx[0];
    }
    const r1 = Math.min(w, h) / 2 - 0.5, r2 = r1 - 1.6;
    const frames = Array.from({ length: n }, (_, t) => base.map((c, p) => {
      if (c !== 0) return c;
      const x = p % w, y = (p / w) | 0, d = Math.hypot(x - cx, y - cy);
      const a = (Math.atan2(x - cx, cy - y) / (2 * Math.PI) + 1) % 1;   // 0 = top, clockwise
      const quarter = (turn: number) => Math.floor((((a - turn) % 1) + 1) % 1 * 4);
      if (Math.abs(d - r1) < 0.7) return [red, yellow, green, gap][quarter(t / n)];
      if (Math.abs(d - r2) < 0.7) return [gap, gap, blue, purple][quarter(-2 * t / n)];
      return 0;
    }));
    return { frames, palette: pal };
  }
  const frames = Array.from({ length: n }, (_, t) => base.map((c, p) => {
    if (c !== 0) return c;
    const x = p % w, y = (p / w) | 0;
    const ang = Math.atan2(y - cy, x - cx) / (2 * Math.PI) + 0.5;
    const v = ang * k + (Math.hypot(x - cx, y - cy) / rmax) * k - (t * k) / n;
    return idx[((Math.floor(v) % k) + k) % k];
  }));
  return { frames, palette };
}

export function generateEffect(kind: EffectKind, base: Frame, w: number, h: number, o: EffectOptions): EffectResult {
  if (kind === 'rainbow') return rainbow(base, w, h, o);
  return { frames: generateFrames(kind, base, w, h, o) };
}

function generateFrames(kind: EffectKind, base: Frame, w: number, h: number, o: EffectOptions): Frame[] {
  const n = Math.max(1, Math.round(o.frames));
  const [vx, vy] = dirVec(o.dir ?? 'left');
  const span = vx ? w : h;
  const out = (o.mode ?? (kind === 'dissolve' ? 'out' : 'in')) === 'out';
  switch (kind) {
    case 'scrollText':
      return scrollText(base, w, h, o);
    case 'scrollImage': {
      const step = Math.max(1, o.step ?? 1);
      const out: Frame[] = [];
      for (let s = step; s <= span; s += step) out.push(shift(base, w, h, vx * s, vy * s));
      return out;
    }
    case 'wave':
      return wave(base, w, h, o);
    case 'slideIn': // enters moving in `dir`, so it starts on the opposite side
      return Array.from({ length: n }, (_, i) => {
        const d = Math.round(span * (1 - (i + 1) / n));
        return offset(base, w, h, -vx * d, -vy * d);
      });
    case 'slideOut':
      return Array.from({ length: n }, (_, i) => {
        const d = Math.round(span * ((i + 1) / n));
        return offset(base, w, h, vx * d, vy * d);
      });
    case 'bounceIn':
      return Array.from({ length: n }, (_, i) =>
        offset(base, w, h, 0, -Math.round(h * (1 - easeOutBounce((i + 1) / n)))));
    case 'grow':
      return Array.from({ length: n }, (_, i) => scale(base, w, h, (i + 1) / n));
    case 'shrink':
      return Array.from({ length: n }, (_, i) => scale(base, w, h, 1 - (i + 1) / n));
    case 'blink':
      return [[...base], blankFrame(w, h)];
    case 'colorCycle': {
      const used = [...new Set(base.filter(c => c !== 0))].sort((a, b) => a - b);
      if (used.length < 2) return [];
      return used.map((_, t) => {
        const map = new Map(used.map((c, i) => [c, used[(i + t + 1) % used.length]]));
        return base.map(c => map.get(c) ?? c);
      });
    }
    case 'shake': {
      const a = Math.max(1, o.amp ?? 1);
      const seq = [a, 0, -a, 0];
      return Array.from({ length: n }, (_, i) => offset(base, w, h, seq[i % 4], 0));
    }
    case 'wipe': // edge travelling in `dir`: reveals (in) or erases (out)
      return Array.from({ length: n }, (_, i) => {
        const done = Math.round((span * (i + 1)) / n);
        return base.map((c, p) => {
          const x = p % w, y = (p / w) | 0;
          const pos = vx > 0 ? x : vx < 0 ? w - 1 - x : vy > 0 ? y : h - 1 - y;
          return (pos < done) !== out ? c : 0;
        });
      });
    case 'dissolve': {
      const r = rng(7);
      const order = base.map((_, p) => p);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const rank = new Array(order.length);
      order.forEach((p, i) => { rank[p] = i; });
      return Array.from({ length: n }, (_, i) => {
        const done = Math.round((order.length * (i + 1)) / n);
        return base.map((c, p) => ((rank[p] < done) !== out ? c : 0));
      });
    }
    case 'sparkle': {
      // Stars twinkle dot -> plus -> dot on empty pixels only; timing wraps so the loop is seamless.
      const r = rng(11);
      const spark = o.color || 1;
      const free = base.map((c, p) => (c === 0 ? p : -1)).filter(p => p >= 0);
      const pool = free.length ? free : base.map((_, p) => p);
      const perFrame = Math.max(2, Math.round((w * h) / 80));
      const stars = Array.from({ length: perFrame * Math.ceil(n / 3) }, () => ({
        p: pool[Math.floor(r() * pool.length)], t0: Math.floor(r() * n),
      }));
      return Array.from({ length: n }, (_, t) => {
        const f = [...base];
        const put = (x: number, y: number) => {
          if (x >= 0 && y >= 0 && x < w && y < h && base[y * w + x] === 0) f[y * w + x] = spark;
        };
        for (const s of stars) {
          const age = (t - s.t0 + n) % n;
          if (age > 2) continue;
          const x = s.p % w, y = (s.p / w) | 0;
          put(x, y);
          if (age === 1) { put(x - 1, y); put(x + 1, y); put(x, y - 1); put(x, y + 1); }
        }
        return f;
      });
    }
    case 'heartbeat':
      return [1, 1.2, 1, 1.3, 1, 1, 1].map(sc => scale(base, w, h, sc));
    default:
      return [];
  }
}
