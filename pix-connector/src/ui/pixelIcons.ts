// 12×12 pixel-art toolbar icons, encoded as transparent PNG data URIs.

const COLORS: Record<string, [number, number, number]> = {
  w: [232, 232, 232], g: [138, 138, 138], k: [80, 80, 80],
  c: [0, 212, 255], y: [255, 204, 51], o: [255, 154, 60],
  p: [255, 122, 168], r: [255, 90, 90], G: [74, 222, 128],
  b: [91, 140, 255], v: [176, 124, 255],
};

const RAW: Record<string, string[]> = {
  pen: [
    '.........pp.', '........pppp', '.......kkpp.', '......yykk..',
    '.....yyyy...', '....yyyy....', '...yyyy.....', '..yyyy......',
    '..oyy.......', '.ooo........', '.kk.........', '............',
  ],
  eraser: [
    '............', '.......ww...', '......wwww..', '.....wwwwww.',
    '....pwwwwwww', '...ppwwwwww.', '..pppwwwww..', '.ppppwwww...',
    '.pppppww....', '..pppp......', '...pp..gggg.', '............',
  ],
  line: [
    '..........ww', '..........ww', '.........c..', '........c...',
    '.......c....', '......c.....', '.....c......', '....c.......',
    '...c........', '..c.........', 'ww..........', 'ww..........',
  ],
  rect: [
    '............', '.cccccccccc.', '.c........c.', '.c........c.',
    '.c........c.', '.c........c.', '.c........c.', '.c........c.',
    '.c........c.', '.c........c.', '.cccccccccc.', '............',
  ],
  fill: [
    '............', '...wwwww....', '..w.....w...', '.wwwwwwwww..',
    '.wcccccccw..', '.wcccccccwc.', '..wcccccw.c.', '..wcccccw.cc',
    '..wcccccw.cc', '...wwwww....', '............', '............',
  ],
  pick: [
    '.........gg.', '........gggg', '.......wggg.', '......w.wg..',
    '.....w.w....', '....w.w.....', '...w.w......', '..wcw.......',
    '.wcw........', '.cw.........', 'c...........', 'c...........',
  ],
  undo: [
    '............', '...w........', '..ww........', '.wwwwwwww...',
    '..ww.....w..', '...w......w.', '..........w.', '..........w.',
    '.........w..', '.....wwww...', '............', '............',
  ],
  flipH: [
    '.....gg.....', '............', '...c.gg.w...', '..cc....ww..',
    '.ccc.gg.www.', 'cccc....wwww', '.ccc.gg.www.', '..cc....ww..',
    '...c.gg.w...', '............', '.....gg.....', '............',
  ],
  right: [
    '............', '......c.....', '......cc....', '......ccc...',
    '......cccc..', '.ccccccccccc', '.ccccccccccc', '......cccc..',
    '......ccc...', '......cc....', '......c.....', '............',
  ],
  chevron: [
    '............', '...ww.......', '....ww......', '.....ww.....',
    '......ww....', '.......ww...', '.......ww...', '......ww....',
    '.....ww.....', '....ww......', '...ww.......', '............',
  ],
  clear: [
    'gggggggggggg', 'g..........g', 'g.r......r.g', 'g..r....r..g',
    'g...r..r...g', 'g....rr....g', 'g....rr....g', 'g...r..r...g',
    'g..r....r..g', 'g.r......r.g', 'g..........g', 'gggggggggggg',
  ],
  copy: [
    '............', 'wwwwwww.....', 'w.....w.....', 'w.....w.....',
    'w..cccccccc.', 'w..c......c.', 'w..c......c.', 'wwwc......c.',
    '...c......c.', '...c......c.', '...cccccccc.', '............',
  ],
  paste: [
    '....gggg....', '.wwwg..gwww.', '.w..gggg..w.', '.w........w.',
    '.w.cccccc.w.', '.w........w.', '.w.cccccc.w.', '.w........w.',
    '.w.cccc...w.', '.w........w.', '.wwwwwwwwww.', '............',
  ],
  onion: [
    '.....G......', '.....G......', '....vvv.....', '...vvvvv....',
    '..vv.v.vv...', '.vv.v.v.vv..', '.vv.v.v.vv..', '.vv.v.v.vv..',
    '..vv.v.vv...', '...vvvvv....', '....g.g.....', '............',
  ],
  play: [
    '............', '...G........', '...GG.......', '...GGG......',
    '...GGGG.....', '...GGGGG....', '...GGGGG....', '...GGGG.....',
    '...GGG......', '...GG.......', '...G........', '............',
  ],
  save: [
    '............', '.bbbbbbbbb..', '.bb.www.bbb.', '.bb.www.bbb.',
    '.bb.....bbb.', '.bbbbbbbbbb.', '.bwwwwwwwwb.', '.bw......wb.',
    '.bwwwwwwwwb.', '.bw......wb.', '.bbbbbbbbbb.', '............',
  ],
  upload: [
    '.....cc.....', '....cccc....', '...cccccc...', '..cc.cc.cc..',
    '.....cc.....', '.....cc.....', '.....cc.....', '.w...cc...w.',
    '.w........w.', '.w........w.', '.wwwwwwwwww.', '............',
  ],
  add: [
    '............', '.....ww.....', '.....ww.....', '.....ww.....',
    '.....ww.....', '.wwwwwwwwww.', '.wwwwwwwwww.', '.....ww.....',
    '.....ww.....', '.....ww.....', '.....ww.....', '............',
  ],
  dup: [
    '............', 'wwwwwww.....', 'w.....w.....', 'w.....w.....',
    'w..wwwwwwww.', 'w..w......w.', 'w..w..G...w.', 'wwww.GGG..w.',
    '...w..G...w.', '...w......w.', '...wwwwwwww.', '............',
  ],
  del: [
    '....rrrr....', '.rrrrrrrrrr.', '............', '..rrrrrrrr..',
    '..r.r..r.r..', '..r.r..r.r..', '..r.r..r.r..', '..r.r..r.r..',
    '..r.r..r.r..', '..r.r..r.r..', '..rrrrrrrr..', '............',
  ],
  time: [
    '............', '...wwwwww...', '..w......w..', '.w...c....w.',
    '.w...c....w.', '.w...c....w.', '.w...cccc.w.', '.w........w.',
    '.w........w.', '..w......w..', '...wwwwww...', '............',
  ],
  effects: [
    '..y......y..', '.yyy....yyy.', '..y......y..', '........w...',
    '.......w....', '......w..y..', '.....w......', '....k.......',
    '...k........', '..k.........', '.k..........', 'k...........',
  ],
  text: [
    '............', '..wwwwwww...', '..w..w..w...', '.....w......',
    '.....w......', '.....w......', '....www.....', '............',
    '..c.........', '.cccccccccc.', '..c.........', '............',
  ],
  wave: [
    '............', '............', '............', '.cc.....cc..',
    'c..c...c..c.', '....c.c....c', '.....c......', '............',
    '.bb.....bb..', 'b..b...b..b.', '....b.b....b', '.....b......',
  ],
  expand: [
    'cccc....cccc', 'cc........cc', 'c.c......c.c', 'c..c....c..c',
    '....wwww....', '....w..w....', '....w..w....', '....wwww....',
    'c..c....c..c', 'c.c......c.c', 'cc........cc', 'cccc....cccc',
  ],
  shrink: [
    'c.c......c.c', '.cc......cc.', 'ccc......ccc', '............',
    '....wwww....', '....w..w....', '....w..w....', '....wwww....',
    '............', 'ccc......ccc', '.cc......cc.', 'c.c......c.c',
  ],
  more: [
    '............', '............', '............', '............',
    '............', '.ww..ww..ww.', '.ww..ww..ww.', '............',
    '............', '............', '............', '............',
  ],
};

const mirror = (rows: string[]) => rows.map(r => r.split('').reverse().join(''));
const transpose = (rows: string[]) => rows[0].split('').map((_, x) => rows.map(r => r[x]).join(''));

export const ICONS: Record<string, string[]> = {
  ...RAW,
  redo: mirror(RAW.undo),
  flipV: transpose(RAW.flipH),
  left: mirror(RAW.right),
  up: transpose(mirror(RAW.right)),
  down: transpose(RAW.right),
  back: mirror(RAW.right).map(r => r.replace(/c/g, 'w')),
  prev: mirror(RAW.chevron),
  next: RAW.chevron,
};

export type IconName = keyof typeof ICONS;

// ── Minimal PNG encoder (RGBA, stored deflate blocks) ──────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return s;
}

export function iconToPngUri(rows: string[], scale = 8, tint?: [number, number, number]): string {
  const W = rows[0].length * scale, H = rows.length * scale;
  const raw = new Uint8Array(H * (W * 4 + 1));
  let o = 0;
  for (let Y = 0; Y < H; Y++) {
    raw[o++] = 0; // filter: none
    const row = rows[Math.floor(Y / scale)];
    for (let X = 0; X < W; X++) {
      const ch = row[Math.floor(X / scale)];
      const c = ch === '.' ? null : tint ?? COLORS[ch] ?? COLORS.w;
      if (c) { raw[o++] = c[0]; raw[o++] = c[1]; raw[o++] = c[2]; raw[o++] = 255; } else o += 4;
    }
  }
  // zlib stream of stored blocks (max 65535 bytes each) + Adler-32.
  const nBlocks = Math.ceil(raw.length / 65535);
  const z = new Uint8Array(2 + raw.length + nBlocks * 5 + 4);
  let zo = 0;
  z[zo++] = 0x78; z[zo++] = 0x01;
  for (let i = 0; i < raw.length; i += 65535) {
    const len = Math.min(65535, raw.length - i);
    z[zo++] = i + len >= raw.length ? 1 : 0;
    z[zo++] = len & 255; z[zo++] = len >> 8;
    z[zo++] = ~len & 255; z[zo++] = (~len >> 8) & 255;
    z.set(raw.subarray(i, i + len), zo); zo += len;
  }
  let a = 1, b = 0;
  for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; b = (b + a) % 65521; }
  z[zo++] = b >> 8; z[zo++] = b & 255; z[zo++] = a >> 8; z[zo++] = a & 255;

  const png = new Uint8Array(8 + 25 + 12 + z.length + 12);
  let p = 0;
  const u32 = (v: number) => { png[p++] = (v >>> 24) & 255; png[p++] = (v >>> 16) & 255; png[p++] = (v >>> 8) & 255; png[p++] = v & 255; };
  const chunk = (type: string, data: Uint8Array) => {
    u32(data.length);
    const start = p;
    for (let i = 0; i < 4; i++) png[p++] = type.charCodeAt(i);
    png.set(data, p); p += data.length;
    u32(crc32(png, start, p));
  };
  png.set([137, 80, 78, 71, 13, 10, 26, 10]); p = 8;
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 6;
  chunk('IHDR', ihdr);
  chunk('IDAT', z);
  chunk('IEND', new Uint8Array(0));
  return 'data:image/png;base64,' + base64(png);
}

const cache: Record<string, string> = {};
export function iconUri(name: IconName): string {
  return (cache[name] ??= iconToPngUri(ICONS[name], 6));
}

// Colour per letter, for tools that render icons outside the app (docs, mockups).
export const ICON_COLORS = COLORS;
