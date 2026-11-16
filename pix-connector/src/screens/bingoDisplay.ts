// Bingo frames for the backpack: column letter on top (75-ball), the number in the bag font, recent
// numbers in a tiny font at the bottom, and a sparkle at the top right for a newly drawn number.
import { textColumns } from '../editor/effects';

export type HistoryMode = 'off' | 'last2' | 'scroll';

// Palette: 0 black, 1-5 column colours (B I N G O), 6-10 the same dimmed, 11/12 white / dim white
// (90-ball), 13-15 sparkle bright -> faint.
const COL: [number, number, number][] = [[40, 120, 255], [255, 40, 40], [255, 255, 255], [40, 220, 80], [255, 210, 0]];
const dim = (c: number[]) => c.map(v => Math.round(v * 0.45));
export const BINGO_PALETTE: number[] = [
  [0, 0, 0], ...COL, ...COL.map(dim), [255, 255, 255], dim([255, 255, 255]),
  [255, 255, 255], [200, 190, 120], [80, 75, 45],
].flat();
const SPARK = [13, 14, 15];

const column = (max: number, n: number) => (max === 75 ? Math.floor((n - 1) / 15) : -1);
const brightIdx = (max: number, n: number) => (column(max, n) < 0 ? 11 : 1 + column(max, n));
const dimIdx = (max: number, n: number) => (column(max, n) < 0 ? 12 : 6 + column(max, n));

const TINY: Record<string, string[]> = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
  B: ['1110', '1001', '1110', '1001', '1110'], I: ['111', '010', '010', '010', '111'],
  N: ['1001', '1101', '1011', '1001', '1001'], G: ['0111', '1000', '1011', '1001', '0111'],
  O: ['0110', '1001', '1001', '1001', '0110'],
};
const tinyWidth = (s: string) => [...s].reduce((a, ch) => a + TINY[ch][0].length, 0) + Math.max(0, s.length - 1);

// Tiny text as columns of 5-bit masks (row 0 = bit 0).
function tinyColumns(s: string): number[] {
  const cols: number[] = [];
  [...s].forEach((ch, k) => {
    if (k) cols.push(0);
    const g = TINY[ch];
    for (let x = 0; x < g[0].length; x++) cols.push(g.reduce((m, row, y) => m | (row[x] === '1' ? 1 << y : 0), 0));
  });
  return cols;
}

const LETTER_TOP = 0, NUMBER_TOP = 6, HISTORY_TOP = 15;

// Letter + big number for the current draw.
function baseFrame(max: number, n: number | undefined, w: number, h: number): number[] {
  const f = new Array(w * h).fill(0);
  if (!n) return f;
  const put = (x: number, y: number, c: number) => { if (x >= 0 && x < w && y >= 0 && y < h) f[y * w + x] = c; };
  const c = brightIdx(max, n);
  if (max === 75) {
    const letter = 'BINGO'[column(max, n)];
    const cols = tinyColumns(letter), x0 = Math.floor((w - cols.length) / 2);
    cols.forEach((m, i) => { for (let r = 0; r < 5; r++) if ((m >> r) & 1) put(x0 + i, LETTER_TOP + r, c); });
  }
  const big = textColumns(String(n));
  while (big.length && big[big.length - 1] === 0) big.pop();
  const x0 = Math.floor((w - big.length) / 2);
  big.forEach((m, i) => { for (let r = 5; r <= 13; r++) if ((m >> r) & 1) put(x0 + i, NUMBER_TOP + r - 5, c); });
  return f;
}

// Recent numbers as one strip of (column mask, palette index) pairs.
function historyStrip(max: number, recent: number[], gap: number): { m: number; c: number }[] {
  const out: { m: number; c: number }[] = [];
  recent.forEach((n, k) => {
    if (k) for (let i = 0; i < gap; i++) out.push({ m: 0, c: 0 });
    for (const m of tinyColumns(String(n))) out.push({ m, c: dimIdx(max, n) });
  });
  return out;
}

function drawStrip(f: number[], w: number, h: number, strip: { m: number; c: number }[], offset: number, wrap: boolean) {
  for (let x = 0; x < w; x++) {
    const i = wrap ? (x + offset) % strip.length : x + offset;
    const s = strip[i];
    if (!s) continue;
    for (let r = 0; r < 5; r++) {
      const y = HISTORY_TOP + r;
      if ((s.m >> r) & 1 && y < h) f[y * w + x] = s.c;
    }
  }
}

// Twinkle at the top right: plus / cross shapes fading bright -> faint.
const STAGES: { shape: 'plus' | 'cross' | 'dot'; c: number }[] = [
  { shape: 'plus', c: SPARK[0] }, { shape: 'cross', c: SPARK[0] }, { shape: 'plus', c: SPARK[0] },
  { shape: 'cross', c: SPARK[1] }, { shape: 'plus', c: SPARK[1] }, { shape: 'dot', c: SPARK[1] },
  { shape: 'plus', c: SPARK[2] }, { shape: 'dot', c: SPARK[2] },
];
function sparkle(f: number[], w: number, h: number, stage: number): number[] {
  const s = STAGES[stage];
  const out = [...f];
  const cx = w - 2, cy = 1;
  const pts = s.shape === 'dot' ? [[0, 0]]
    : s.shape === 'plus' ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
    : [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const [dx, dy] of pts) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && x < w && y >= 0 && y < h && out[y * w + x] === 0) out[y * w + x] = s.c;
  }
  return out;
}

export interface BingoAnimation {
  frames: number[][];
  durations: number[];
  direction: number;       // always 0 (loop): play-once isn't honoured by older firmware
  clean?: number[][];      // sparkle-free versions of the frames, for the caller to swap in once it has played
}

// Welcome: "Bingo" in the bag font scrolling right to left, one column colour per letter, looping.
export function welcomeAnimation(w: number, h: number): BingoAnimation {
  const strip: { m: number; c: number }[] = [];
  [...'Bingo'].forEach((ch, k) => {
    const cols = textColumns(ch);
    while (cols.length && cols[cols.length - 1] === 0) cols.pop();
    if (k) strip.push({ m: 0, c: 0 });
    for (const m of cols) strip.push({ m, c: 1 + k });
  });
  for (let i = 0; i < 8; i++) strip.push({ m: 0, c: 0 });
  const frames = strip.map((_, t) => {
    const f = new Array(w * h).fill(0);
    for (let x = 0; x < w; x++) {
      const s = strip[(x + t) % strip.length];
      for (let y = 0; y < Math.min(h, 20); y++) if ((s.m >> y) & 1) f[y * w + x] = s.c;
    }
    return f;
  });
  return { frames, durations: frames.map(() => 100), direction: 0 };
}

export function bingoAnimation(max: number, called: number[], w: number, h: number, history: HistoryMode, isNew: boolean): BingoAnimation {
  const n = called[called.length - 1];
  const base = baseFrame(max, n, w, h);
  const recent = called.slice(0, -1).reverse();
  const SPARK_MS = 300;

  // Scrolling recent numbers (only when they don't fit across the display).
  if (history === 'scroll' && n) {
    const strip = historyStrip(max, recent.slice(0, 5), 3);
    if (strip.length > w) {
      for (let i = 0; i < 4; i++) strip.push({ m: 0, c: 0 });
      const STEP_MS = 150;
      const clean = strip.map((_, t) => { const f = [...base]; drawStrip(f, w, h, strip, t, true); return f; });
      const per = SPARK_MS / STEP_MS;
      const frames = clean.map((f, t) => (isNew && t < STAGES.length * per ? sparkle(f, w, h, Math.floor(t / per)) : f));
      return { frames, durations: frames.map(() => STEP_MS), direction: 0, clean: isNew ? clean : undefined };
    }
  }

  // Static: recent numbers that fit, sparkle frames played once, ending on the clean frame.
  const still = [...base];
  if (history !== 'off' && n) {
    const fit: number[] = [];
    let used = 0;
    for (const r of recent) {
      const add = tinyWidth(String(r)) + (fit.length ? 2 : 0);
      if (used + add > w) break;
      fit.push(r);
      used += add;
    }
    drawStrip(still, w, h, historyStrip(max, fit, 2), 0, false);
  }
  if (!isNew || !n) return { frames: [still], durations: [1000], direction: 0 };
  // Older firmware ignores "play once", so this loops; the caller swaps in the clean frames afterwards.
  const frames = [...STAGES.map((_, i) => sparkle(still, w, h, i)), still];
  return {
    frames,
    durations: [...STAGES.map(() => SPARK_MS), 1000],
    direction: 0,
    clean: frames.map(() => still),
  };
}
