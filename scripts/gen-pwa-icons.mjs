// Generates the PWA icon set as PNGs with no external dependencies.
//
// We have no image tooling (ImageMagick / sharp / rsvg) available in this
// environment, so this script hand-encodes PNGs: it rasterizes a simple
// "Hisamed H" mark — a white H on the brand teal (#0D9488) — into an RGBA
// buffer and writes it out using Node's built-in zlib for the IDAT stream.
//
// Run with:  node scripts/gen-pwa-icons.mjs
// Outputs to public/icons/. Re-run if the brand color or mark changes.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/icons');

const TEAL = [13, 148, 136, 255]; // teal-600 #0D9488 — the app brand color
const WHITE = [255, 255, 255, 255];

// ── CRC32 (required by the PNG chunk format) ─────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // [10..12] = compression/filter/interlace = 0

  // Raw image data: one filter byte (0 = None) per scanline, then RGBA pixels.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing ──────────────────────────────────────────────────────────────────
function makeMark(size, { inset = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);

  // Fill the whole canvas with the brand teal (full-bleed — the OS/maskable
  // mask rounds the corners, so no transparency is needed).
  for (let i = 0; i < size * size; i++) {
    rgba.set(TEAL, i * 4);
  }

  const fillRect = (fx0, fy0, fx1, fy1, color) => {
    // Apply the maskable safe-zone inset by scaling fractions around center.
    const map = (f) => 0.5 + (f - 0.5) * inset;
    const x0 = Math.round(map(fx0) * size);
    const x1 = Math.round(map(fx1) * size);
    const y0 = Math.round(map(fy0) * size);
    const y1 = Math.round(map(fy1) * size);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        rgba.set(color, (y * size + x) * 4);
      }
    }
  };

  // The "H": two vertical bars + a center crossbar.
  fillRect(0.3, 0.27, 0.42, 0.73, WHITE); // left bar
  fillRect(0.58, 0.27, 0.7, 0.73, WHITE); // right bar
  fillRect(0.3, 0.455, 0.7, 0.545, WHITE); // crossbar

  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, inset: 1 },
  { file: 'icon-512.png', size: 512, inset: 1 },
  // Maskable: pull the mark into the ~80% safe zone so circular masks don't
  // clip the H.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.78 },
  { file: 'apple-touch-icon.png', size: 180, inset: 1 },
];

for (const t of targets) {
  writeFileSync(resolve(OUT_DIR, t.file), makeMark(t.size, { inset: t.inset }));
  console.log(`wrote ${t.file} (${t.size}x${t.size})`);
}
