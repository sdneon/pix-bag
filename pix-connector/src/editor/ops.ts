// Pure pixel operations on a flat frame (row-major palette indices).

export type Frame = number[];

export function blankFrame(w: number, h: number): Frame {
  return new Array(w * h).fill(0);
}

// Cells on the line between two points (Bresenham), endpoints included.
export function lineCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

export function floodFill(f: Frame, w: number, h: number, x: number, y: number, color: number): Frame {
  const target = f[y * w + x];
  if (target === color) return f;
  const next = [...f];
  const stack = [y * w + x];
  while (stack.length) {
    const i = stack.pop()!;
    if (next[i] !== target) continue;
    next[i] = color;
    const cx = i % w, cy = (i / w) | 0;
    if (cx > 0) stack.push(i - 1);
    if (cx < w - 1) stack.push(i + 1);
    if (cy > 0) stack.push(i - w);
    if (cy < h - 1) stack.push(i + w);
  }
  return next;
}

export function flipH(f: Frame, w: number, h: number): Frame {
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = f[y * w + (w - 1 - x)];
  return out;
}

export function flipV(f: Frame, w: number, h: number): Frame {
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = f[(h - 1 - y) * w + x];
  return out;
}

// Shift with wrap-around.
export function shift(f: Frame, w: number, h: number, dx: number, dy: number): Frame {
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = (x - dx + w) % w, sy = (y - dy + h) % h;
      out[y * w + x] = f[sy * w + sx];
    }
  }
  return out;
}

// Outline rectangle between two corners.
export function rectCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0];
  const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0];
  for (let x = ax; x <= bx; x++) { out.push([x, ay]); out.push([x, by]); }
  for (let y = ay + 1; y < by; y++) { out.push([ax, y]); out.push([bx, y]); }
  return out;
}

// Replace every pixel of one palette index with another.
export function replaceColor(f: Frame, from: number, to: number): Frame {
  return f.map(c => (c === from ? to : c));
}
