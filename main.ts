// The World in One Day — Friday, 20 November 2026
// A single-file newspaper front page drawn with pure TypeScript.
// Node 22+ stdlib only: no dependencies, no network, no image files.
// Generates a 1024x1024 PNG at $MAKEFUN_OUTPUT_DIR/entry.png (default "out").
//
// Stories (all verified 20 Nov 2026, see README):
//  1. ICJ rules Myanmar committed genocide against the Rohingya (UN News, Reuters, CNN)
//  2. Trump, Xi and Putin hold first-ever trilateral summit in Shenzhen (CNN, NY Post, The Times)
//  3. Houthi missile hits Riyadh's PIF Tower (Reuters, WSJ)
//  4. Cyclone Akvan makes landfall near Gopalpur, Odisha (IMD, The Hindu)
//  5. Anthropic IPO debuts on Nasdaq at $83, closes $97.17 (Nasdaq, Motley Fool, Reuters)
//  6. NASA confirms Voyager 1 passed one light-day from Earth (NASA, Reuters)
//  7. Sport: Henry Nicholls 113* for New Zealand v India, Wellington (Jagran Josh)

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette ---
const PAPER: RGB = [246, 241, 227];
const INK: RGB = [26, 26, 26];
const RED: RGB = [179, 38, 30];
const BLUE: RGB = [31, 78, 121];
const NAVY: RGB = [16, 32, 56];
const GOLD: RGB = [201, 162, 39];
const TEAL: RGB = [14, 124, 123];
const SKY: RGB = [176, 208, 224];
const CREAM: RGB = [250, 246, 234];
const GREY: RGB = [110, 110, 104];
const LIGHTGREY: RGB = [226, 222, 210];
const GREEN: RGB = [34, 139, 80];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

type RGB = [number, number, number];

// ---------------------------------------------------------------- canvas ---
const buf = Buffer.alloc(W * H * 3);

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, t, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPx(cx + x, cy + y, c);
  }
}

function ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      setPx(Math.round(cx + (r + k - t / 2) * Math.cos(rad)), Math.round(cy + (r + k - t / 2) * Math.sin(rad)), c);
    }
  }
}

// Filled triangle via scanline edge walk.
function triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const xa = Math.max(0, Math.floor(Math.min(...xs)));
      const xb = Math.min(W - 1, Math.ceil(Math.max(...xs)));
      for (let x = xa; x <= xb; x++) setPx(x, y, c);
    }
  }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function vgrad(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB): void {
  for (let yy = 0; yy < h; yy++) {
    fillRect(x, y + yy, w, 1, mix(top, bottom, yy / Math.max(1, h - 1)));
  }
}

// Deterministic pseudo-random (fixed seed) — no Math.random, output is stable.
let seed = 123456789;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// ------------------------------------------------------------------- font ---
// 5x7 pixel font, one row per number (5 bits). Uppercase + digits + punctuation.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "*": [0, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  "°": [0x0c, 0x12, 0x12, 0x0c, 0, 0, 0],
  "•": [0, 0x0e, 0x0e, 0x0e, 0, 0, 0],
};

function normChar(ch: string): string {
  if (ch === "—" || ch === "–") return "-";
  if (ch === "’" || ch === "‘") return "'";
  if (ch === "“" || ch === "”") return '"';
  return ch.toUpperCase();
}

function drawChar(x: number, y: number, ch: string, s: number, c: RGB): void {
  const g = FONT[normChar(ch)] ?? FONT["?"];
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) fillRect(x + col * s, y + row * s, s, s, c);
    }
  }
}

function textWidth(text: string, s: number): number {
  return text.length * 6 * s - s;
}

function drawText(x: number, y: number, text: string, s: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    drawChar(cx, y, ch, s, c);
    cx += 6 * s;
  }
}

function drawTextCentered(cx: number, y: number, text: string, s: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, s) / 2), y, text, s, c);
}

function wrap(text: string, maxW: number, s: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (textWidth(test, s) <= maxW) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawWrapped(x: number, y: number, maxW: number, text: string, s: number, c: RGB, lh: number): number {
  const lines = wrap(text, maxW, s);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * lh, lines[i], s, c);
  }
  return y + lines.length * lh;
}

// -------------------------------------------------------------------- png ---
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter none
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- page scenes --

// Scales of justice emblem, centred at (cx, cy), size s (beam half-width).
function drawScales(cx: number, cy: number, s: number, c: RGB): void {
  const top = cy - s;
  const bar = cy - Math.floor(s * 0.55);
  vline(cx, top, Math.floor(s * 1.5), c, 3);
  circle(cx, top, 4, c);
  hline(cx - s, bar, 2 * s, c, 3);
  // left pan
  line(cx - s, bar, cx - s - Math.floor(s * 0.32), bar + Math.floor(s * 0.55), c, 2);
  line(cx - s, bar, cx - s + Math.floor(s * 0.32), bar + Math.floor(s * 0.55), c, 2);
  triangle(cx - s - Math.floor(s * 0.4), bar + Math.floor(s * 0.55), cx - s + Math.floor(s * 0.4), bar + Math.floor(s * 0.55), cx - s, bar + Math.floor(s * 0.95), c);
  // right pan
  line(cx + s, bar, cx + s - Math.floor(s * 0.32), bar + Math.floor(s * 0.55), c, 2);
  line(cx + s, bar, cx + s + Math.floor(s * 0.32), bar + Math.floor(s * 0.55), c, 2);
  triangle(cx + s - Math.floor(s * 0.4), bar + Math.floor(s * 0.55), cx + s + Math.floor(s * 0.4), bar + Math.floor(s * 0.55), cx + s, bar + Math.floor(s * 0.95), c);
  // base
  hline(cx - Math.floor(s * 0.5), cy + Math.floor(s * 0.5), s, c, 3);
}

function drawMasthead(): void {
  // Paper + frame
  fillRect(0, 0, W, H, PAPER);
  fillRect(0, 0, W, 10, INK);
  fillRect(0, H - 10, W, 10, INK);
  fillRect(0, 0, 10, H, INK);
  fillRect(W - 10, 0, 10, H, INK);
  // Nameplate
  drawTextCentered(512, 34, "THE WORLD IN ONE DAY", 5, INK);
  hline(48, 92, 928, INK, 3);
  hline(48, 98, 928, INK, 1);
  // Date line — the day, loud and clear
  drawTextCentered(512, 112, "FRIDAY, 20 NOVEMBER 2026", 3, RED);
  drawTextCentered(512, 138, "SEVEN STORIES FROM AROUND THE GLOBE - ONE PAGE", 1, GREY);
  hline(48, 162, 928, INK, 2);
}

// Lead story: ICJ genocide ruling. Panel x=28..452, y=176..486.
function drawLead(): void {
  const x = 28, y = 176, w = 424, h = 310;
  // Courthouse scene
  vgrad(x, y, w, h, SKY, [214, 228, 214]);
  // sun
  circle(x + 350, y + 42, 22, GOLD);
  // courthouse
  const cx0 = x + 42, cx1 = x + w - 42, base = y + h - 34;
  fillRect(cx0, base - 118, cx1 - cx0, 118, [232, 226, 208]); // main block
  // pediment
  triangle(cx0 - 8, base - 118, cx1 + 8, base - 118, x + w / 2, base - 168, BLUE);
  circle(x + w / 2, base - 138, 20, GOLD);
  drawScales(x + w / 2, base - 138, 12, NAVY);
  // columns
  for (let i = 0; i < 5; i++) {
    const colX = cx0 + 16 + i * ((cx1 - cx0 - 32 - 18) / 4);
    fillRect(colX, base - 112, 18, 112, WHITE);
    fillRect(colX, base - 112, 18, 5, NAVY);
    fillRect(colX, base - 8, 18, 5, NAVY);
  }
  // steps
  fillRect(cx0 - 14, base, cx1 - cx0 + 28, 8, LIGHTGREY);
  fillRect(cx0 - 22, base + 8, cx1 - cx0 + 44, 8, GREY);
  fillRect(cx0 - 30, base + 16, cx1 - cx0 + 60, 8, [90, 90, 84]);
  // caption strip
  fillRect(x, y + h - 30, w, 30, NAVY);
  drawTextCentered(x + w / 2, y + h - 21, "THE PEACE PALACE, THE HAGUE", 1, WHITE);
  // frame
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);

  // Lead text, right of the panel
  const tx = 480, tw = 496;
  let ty = 178;
  drawText(tx, ty, "THE HAGUE  •  WORLD COURT", 2, RED);
  ty += 34;
  ty = drawWrapped(tx, ty, tw, "MYANMAR GUILTY OF GENOCIDE", 3, INK, 30);
  ty += 6;
  hline(tx, ty, tw, RED, 3);
  ty += 14;
  ty = drawWrapped(
    tx, ty, tw,
    "The UN's top court rules Myanmar committed genocide against the Rohingya in 2017 - the first time the court has held a state guilty of genocide.",
    2, INK, 17,
  );
  ty += 10;
  ty = drawWrapped(
    tx, ty, tw,
    "About 10,000 Rohingya were killed in the army's clearance operations. Myanmar is ordered to pay reparations and allow refugees to return home.",
    2, [64, 64, 60], 17,
  );
}

// Middle story card: illustration on top, kicker, headline, summary.
function drawMiddleCard(x: number, y: number, w: number, art: () => void, kicker: string, headline: string, summary: string): void {
  const artH = 136;
  art();
  let ty = y + artH + 10;
  drawText(x, ty, kicker, 1, RED);
  ty += 16;
  ty = drawWrapped(x, ty, w, headline, 2, INK, 17);
  ty += 6;
  drawWrapped(x, ty, w, summary, 2, [64, 64, 60], 16);
}

// Summit scene: three leaders' flags over a Shenzhen skyline. Panel x=28..500, y=508..644.
function drawSummitArt(): void {
  const x = 28, y = 508, w = 472, h = 136;
  vgrad(x, y, w, h, [214, 226, 238], [238, 232, 214]);
  // skyline silhouette
  const bcol: RGB = [70, 92, 122];
  fillRect(x + 18, y + 84, 44, 48, bcol);
  fillRect(x + 70, y + 66, 36, 66, bcol);
  fillRect(x + 114, y + 92, 52, 40, bcol);
  fillRect(x + 300, y + 76, 40, 56, bcol);
  fillRect(x + 348, y + 58, 30, 74, bcol);
  fillRect(x + 386, y + 88, 56, 44, bcol);
  triangle(x + 70, y + 66, x + 106, y + 66, x + 88, y + 46, bcol);
  // table
  fillRect(x + 150, y + 106, 172, 10, [122, 82, 48]);
  fillRect(x + 156, y + 116, 8, 16, [96, 64, 36]);
  fillRect(x + 308, y + 116, 8, 16, [96, 64, 36]);
  // three seated figures
  const heads: RGB[] = [BLUE, RED, [58, 90, 58]];
  for (let i = 0; i < 3; i++) {
    const fx = x + 186 + i * 50;
    circle(fx, y + 80, 13, [232, 196, 160]);
    triangle(fx - 18, y + 106, fx + 18, y + 106, fx, y + 88, heads[i]);
  }
  // three flags on poles above
  const poles = [x + 176, x + 236, x + 296];
  const flagCols: RGB[][] = [
    [[178, 34, 52], [255, 255, 255], [178, 34, 52]],
    [[222, 41, 16], [222, 41, 16], [222, 41, 16]],
    [[255, 255, 255], [0, 57, 166], [213, 0, 50]],
  ];
  for (let i = 0; i < 3; i++) {
    vline(poles[i], y + 14, 52, INK, 3);
    for (let s = 0; s < 3; s++) {
      fillRect(poles[i] + 3, y + 16 + s * 10, 34, 10, flagCols[i][s]);
    }
    if (i === 1) { // yellow stars on the red flag
      circle(poles[i] + 10, y + 21, 3, GOLD);
      circle(poles[i] + 20, y + 20, 2, GOLD);
      circle(poles[i] + 18, y + 27, 2, GOLD);
    }
    if (i === 0) { // blue canton on the US flag
      fillRect(poles[i] + 3, y + 16, 16, 14, BLUE);
      circle(poles[i] + 11, y + 23, 2, WHITE);
    }
  }
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

// Riyadh scene: PIF Tower struck at night. Panel x=504..976, y=508..644.
function drawRiyadhArt(): void {
  const x = 504, y = 508, w = 472, h = 136;
  vgrad(x, y, w, h, [12, 18, 38], [52, 66, 96]);
  // stars
  seed = 777;
  for (let i = 0; i < 40; i++) {
    const sx = x + 8 + Math.floor(rnd() * (w - 16));
    const sy = y + 6 + Math.floor(rnd() * 60);
    fillRect(sx, sy, 2, 2, WHITE);
  }
  // city silhouette
  const bcol: RGB = [30, 42, 66];
  fillRect(x + 12, y + 96, 60, 36, bcol);
  fillRect(x + 84, y + 84, 44, 48, bcol);
  fillRect(x + 380, y + 88, 52, 44, bcol);
  fillRect(x + 438, y + 100, 26, 32, bcol);
  // PIF Tower — tall slab with a pointed crown
  const tx = x + 196;
  fillRect(tx + 14, y + 30, 52, 102, [150, 168, 190]);
  triangle(tx + 14, y + 30, tx + 66, y + 30, tx + 40, y + 8, [150, 168, 190]);
  // lit windows
  seed = 4242;
  for (let i = 0; i < 26; i++) {
    const wy = y + 34 + Math.floor(rnd() * 88);
    const wx = tx + 40 - 13 + Math.floor(rnd() * 26);
    fillRect(wx, wy, 5, 4, [255, 214, 120]);
  }
  // damage: jagged dark patch near the crown, with smoke
  triangle(tx + 22, y + 34, tx + 58, y + 34, tx + 40, y + 60, [20, 20, 24]);
  triangle(tx + 30, y + 46, tx + 52, y + 46, tx + 40, y + 68, [40, 40, 46]);
  circle(tx + 40, y + 24, 10, [120, 120, 118]);
  circle(tx + 54, y + 14, 8, [140, 140, 136]);
  circle(tx + 26, y + 14, 7, [130, 130, 128]);
  // red warning flash
  circle(tx + 40, y + 6, 4, RED);
  // ground line
  fillRect(x, y + h - 6, w, 6, [20, 28, 48]);
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

// Bottom story card: small illustration, headline, summary.
function drawBottomCard(x: number, y: number, w: number, art: () => void, kicker: string, headline: string, summary: string): void {
  const artH = 100;
  art();
  let ty = y + artH + 8;
  drawText(x, ty, kicker, 1, RED);
  ty += 15;
  ty = drawWrapped(x, ty, w, headline, 2, INK, 17);
  ty += 5;
  drawWrapped(x, ty, w, summary, 2, [64, 64, 60], 16);
}

// Cyclone scene. Panel x=28..336, y=762..862.
function drawCycloneArt(): void {
  const x = 28, y = 762, w = 308, h = 100;
  vgrad(x, y, w, h, [24, 96, 128], [120, 190, 210]);
  // spiral: concentric arcs
  const cx = x + 150, cy = y + 50;
  for (let r = 46; r > 6; r -= 8) {
    ring(cx, cy, r, WHITE, 4);
  }
  circle(cx, cy, 8, NAVY);
  // rain slashes
  for (let i = 0; i < 10; i++) {
    const rx = x + 12 + i * 28;
    line(rx, y + 12 + (i % 3) * 8, rx - 8, y + 30 + (i % 3) * 8, [220, 235, 240], 2);
  }
  // coastline + waves at the bottom
  fillRect(x, y + h - 16, w, 16, [232, 220, 190]);
  for (let i = 0; i < 6; i++) {
    line(x + 8 + i * 52, y + h - 8, x + 30 + i * 52, y + h - 8, TEAL, 3);
  }
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

// Anthropic IPO scene. Panel x=358..666, y=762..862.
function drawAnthropicArt(): void {
  const x = 358, y = 762, w = 308, h = 100;
  fillRect(x, y, w, h, NAVY);
  // rising bars
  const bars = [22, 38, 54, 72];
  for (let i = 0; i < 4; i++) {
    fillRect(x + 24 + i * 44, y + h - 18 - bars[i], 30, bars[i], GREEN);
  }
  // arrow
  line(x + 20, y + h - 26, x + 210, y + 14, GOLD, 4);
  line(x + 210, y + 14, x + 186, y + 14, GOLD, 4);
  line(x + 210, y + 14, x + 210, y + 38, GOLD, 4);
  // ticker text
  drawText(x + 216, y + 16, "ANT", 2, WHITE);
  drawText(x + 216, y + 44, "$83", 2, [255, 214, 120]);
  drawText(x + 216, y + 66, "$97", 2, GREEN);
  drawText(x + 216, y + 88, "+17%", 1, WHITE);
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

// Voyager scene. Panel x=688..996, y=762..862.
function drawVoyagerArt(): void {
  const x = 688, y = 762, w = 308, h = 100;
  fillRect(x, y, w, h, BLACK);
  // stars
  seed = 99;
  for (let i = 0; i < 46; i++) {
    const sx = x + 6 + Math.floor(rnd() * (w - 12));
    const sy = y + 6 + Math.floor(rnd() * (h - 12));
    fillRect(sx, sy, 2, 2, WHITE);
  }
  // the Sun, far behind
  circle(x + 34, y + 80, 14, GOLD);
  circle(x + 34, y + 80, 9, [255, 226, 120]);
  // dotted path from the Sun to the probe
  for (let i = 0; i < 12; i++) {
    circle(x + 62 + i * 16, y + 74 - i * 3, 2, [180, 180, 180]);
  }
  // Voyager probe: bus, dish, boom
  const px = x + 238, py = y + 34;
  fillRect(px, py, 34, 20, [190, 196, 204]);
  fillRect(px + 8, py + 5, 18, 10, BLUE);
  circle(px + 44, py + 10, 16, WHITE);
  ring(px + 44, py + 10, 16, [150, 158, 168], 2);
  line(px, py + 10, px - 26, py + 26, [190, 196, 204], 3);
  line(px + 4, py + 20, px - 6, py + 40, [190, 196, 204], 2);
  // "1 LIGHT-DAY" label
  drawText(x + 14, y + 12, "1 LIGHT-DAY", 1, WHITE);
  vline(x, y, h, INK, 2);
  vline(x + w - 2, y, h, INK, 2);
  hline(x, y, w, INK, 2);
  hline(x, y + h - 2, w, INK, 2);
}

function drawFooter(): void {
  // Sport ticker
  const y = 962;
  fillRect(28, y, 64, 22, RED);
  drawText(34, y + 7, "SPORT", 1, WHITE);
  // cricket bat icon
  fillRect(100, y + 4, 6, 14, [150, 105, 60]);
  fillRect(106, y + 8, 14, 8, [180, 132, 74]);
  circle(126, y + 11, 5, RED);
  drawWrapped(
    140, y + 4, 836,
    "NICHOLLS 113* AS NEW ZEALAND REACH 243-5 ON DAY ONE OF THE FIRST TEST AGAINST INDIA IN WELLINGTON.",
    1, INK, 12,
  );
  // Sources + page line
  hline(28, 994, 948, INK, 1);
  drawText(28, 1002, "SOURCES: UN NEWS - REUTERS - CNN - NASA - IMD - NASDAQ - THE TIMES", 1, GREY);
  drawText(976 - textWidth("PAGE 1 OF 1", 1), 1002, "PAGE 1 OF 1", 1, GREY);
}

// ------------------------------------------------------------------- main ---
function main(): void {
  drawMasthead();
  drawLead();
  hline(28, 496, 948, INK, 2);
  drawSummitArt();
  drawMiddleCard(28, 508, 472, () => {}, "SHENZHEN  •  DIPLOMACY", "THREE LEADERS, ONE TABLE", "Trump, Xi and Putin hold the first-ever trilateral summit, vowing nuclear talks and more oil output.");
  drawRiyadhArt();
  drawMiddleCard(504, 508, 472, () => {}, "RIYADH  •  MIDDLE EAST", "MISSILE HITS RIYADH'S TALLEST TOWER", "A Houthi strike blows out windows on seven floors of the PIF Tower. No injuries.");
  hline(28, 750, 948, INK, 2);
  drawCycloneArt();
  drawBottomCard(28, 762, 308, () => {}, "ODISHA  •  WEATHER", "CYCLONE AKVAN HITS INDIA", "Landfall near Gopalpur at noon, winds of 110 km/h. 300,000 flee to shelters.");
  drawAnthropicArt();
  drawBottomCard(358, 762, 308, () => {}, "NEW YORK  •  MARKETS", "ANTHROPIC'S $81BN DEBUT", "Anthropic lists at $83 and closes at $97 - up 17% on day one.");
  drawVoyagerArt();
  drawBottomCard(688, 762, 308, () => {}, "DEEP SPACE  •  SCIENCE", "VOYAGER 1: ONE LIGHT-DAY", "NASA's probe is 25.9bn km away - a full day's light from Earth.");
  drawFooter();

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, encodePNG());
  console.log("Wrote " + outPath);
}

main();
