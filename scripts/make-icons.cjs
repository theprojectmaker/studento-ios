// Generates the app icon, splash, Android icons, favicon and notification icon,
// recreating Studento's icon (period-notify/scripts/gen-icons.mjs: slate square,
// white clock face, two hands, rose "5 min" dot) with 4x4 supersampling.
// Run: node scripts/make-icons.cjs
const fs = require('fs'), zlib = require('zlib'), path = require('path');

const out = path.join(__dirname, '..', 'assets', 'images');
const BG = [15, 23, 42], FACE = [248, 250, 252], HAND = [15, 23, 42], ACCENT = [244, 63, 94];

function crc32(buf) { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function nearSeg(px, py, x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= r;
}

function inRoundedSquare(u, v, r) {
  const nx = Math.min(Math.max(u, r), 1 - r), ny = Math.min(Math.max(v, r), 1 - r);
  return Math.hypot(u - nx, v - ny) <= r;
}

// Color of the clock artwork at unit coords (u, v), centered at .5,.5, scaled by k. null = nothing.
function art(u, v, k) {
  const x = (u - 0.5) / k, y = (v - 0.5) / k;
  const faceR = 0.34, ringR = 0.365, d = Math.hypot(x, y);
  const a = (-60 * Math.PI) / 180, mr = (ringR + faceR) / 2;
  if (Math.hypot(x - Math.cos(a) * mr, y - Math.sin(a) * mr) < 0.045) return ACCENT;
  if (d > ringR) return null;
  if (d <= faceR * 0.85) {
    if (nearSeg(x, y, 0, 0, 0, -faceR * 0.62, 0.02)) return HAND;
    if (nearSeg(x, y, 0, 0, faceR * 0.5, -faceR * 0.32, 0.018)) return HAND;
    if (d < 0.02) return HAND;
  }
  return FACE;
}

/** mode: 'icon' (full-bleed square), 'rounded', 'art' (artwork only, transparent), 'bg', 'mono' (white silhouette). */
function render(size, mode, k = 1) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, al = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = (x + (sx + 0.5) / S) / size, v = (y + (sy + 0.5) / S) / size;
      let c = null;
      if (mode === 'bg' || mode === 'icon') c = BG;
      if (mode === 'rounded' && inRoundedSquare(u, v, 0.22)) c = BG;
      if (mode !== 'bg') {
        const a = art(u, v, k);
        if (a) c = mode === 'mono' ? (a === HAND ? null : [255, 255, 255]) : a;
      }
      if (c) { r += c[0]; g += c[1]; b += c[2]; al++; }
    }
    const i = (y * size + x) * 4, n = S * S;
    if (al) { px[i] = Math.round(r / al); px[i + 1] = Math.round(g / al); px[i + 2] = Math.round(b / al); }
    px[i + 3] = Math.round((al / n) * 255);
  }
  return png(size, size, px);
}

const files = {
  'icon.png': render(1024, 'icon'),
  'splash-icon.png': render(512, 'art', 1.3),
  'android-icon-foreground.png': render(512, 'art', 0.62),
  'android-icon-background.png': render(512, 'bg'),
  'android-icon-monochrome.png': render(512, 'mono', 0.62),
  'favicon.png': render(64, 'rounded'),
  'notification-icon.png': render(96, 'mono', 1.25),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), buf);
  console.log(name, buf.length, 'bytes');
}
