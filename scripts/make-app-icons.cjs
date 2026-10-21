// Renders Studento's app icons from one clock shape ("I" badge): the default plus 20
// colour variants for Settings > App icon. Output:
//   assets/icons/<name>.png          1024x1024, 24-bit RGB (alternate icons)
//   assets/images/icon.png           default icon (same as assets/icons/StudentoNavy.png)
//   assets/images/android-icon-*.png + splash-icon.png + notification-icon.png + favicon.png
//   icon-options/set/*.svg + preview-all.png (contact sheet)
// Rendering uses headless Edge for the SVGs, then System.Drawing (PowerShell) to drop alpha.
// Run: node scripts/make-app-icons.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SET = path.join(ROOT, 'icon-options', 'set');
const ICONS = path.join(ROOT, 'assets', 'icons');
const IMAGES = path.join(ROOT, 'assets', 'images');
fs.mkdirSync(SET, { recursive: true });
fs.mkdirSync(ICONS, { recursive: true });

// name, label, bg top, bg bottom, face, hands, dot, ring (the ring is the bg bottom unless set)
const P = [
  ['StudentoNavy', 'Studento', '#1b2540', '#0f172a', '#f8fafc', '#0f172a', '#f43f5e'],
  ['TrainStation', 'Train Station', '#1c1608', '#0a0a0b', '#f2e8d5', '#0a0a0b', '#e8b84b'],
  ['Midnight', 'Midnight', '#0f1a38', '#060912', '#cfe0ff', '#060912', '#6ea8ff'],
  ['Sunset', 'Sunset', '#ff9a5a', '#d63a5a', '#fff7ed', '#7c2d12', '#3b1d6e'],
  ['Ocean', 'Ocean', '#1f78ab', '#0b3a5c', '#f0fbff', '#0b3a5c', '#ffd166'],
  ['Forest', 'Forest', '#357a43', '#123524', '#f3f8ee', '#123524', '#f4a259'],
  ['Jackpot', 'Jackpot', '#6b0f19', '#14060a', '#f6ecd6', '#14060a', '#f5c542'],
  ['VegasStrip', 'Vegas Strip', '#36105a', '#0b0418', '#fff4fa', '#1b0730', '#ff3ea5'],
  ['MonteCarlo', 'Monte Carlo', '#0d4a35', '#03241a', '#f4efe2', '#03241a', '#d9b45a'],
  ['Gatsby', 'Gatsby', '#191409', '#050505', '#d4af37', '#0a0a0c', '#f8e7a8'],
  ['Champagne', 'Champagne', '#33281a', '#1a1510', '#f1d9a6', '#1a1510', '#fff3d6'],
  ['Emerald', 'Gilded Emerald', '#0d5a44', '#03261c', '#d6b25e', '#03261c', '#f3e6b3'],
  ['Ivory', 'Ivory', '#faf5ea', '#e8dcc4', '#ffffff', '#3a2c14', '#a67c2e'],
  ['Paper', 'Paper', '#ffffff', '#e6eaf0', '#ffffff', '#111827', '#f43f5e'],
  ['PastelPink', 'Pastel Pink', '#ffe0e9', '#ffb3c7', '#ffffff', '#5b1f35', '#7c3aed'],
  ['PastelMint', 'Pastel Mint', '#d4f7e5', '#8fdcb8', '#ffffff', '#0f3d2e', '#f97316'],
  ['PastelLavender', 'Pastel Lavender', '#ebe3ff', '#bfa8ff', '#ffffff', '#2d1b69', '#ec4899'],
  ['Graphite', 'Graphite', '#454952', '#16181d', '#e5e7eb', '#16181d', '#22c55e'],
  ['Neon', 'Neon', '#220a40', '#07020f', '#12121f', '#39ff88', '#ff2bd6'],
  ['RoseGold', 'Rose Gold', '#f7d0c4', '#d98b7c', '#fff7f3', '#5a2d2a', '#8b2e3f'],
  ['Lava', 'Lava', '#8f2410', '#2a0803', '#fff1e0', '#2a0803', '#ffb020'],
];

function svg([name, , top, bottom, face, hands, dot], opts = {}) {
  const { transparent = false, mono = false } = opts;
  const g = `g${name}`;
  const bg = transparent ? '' : `<rect width="1024" height="1024" fill="url(#${g})"/>`;
  const defs = `<defs><radialGradient id="${g}" cx="0.5" cy="0.3" r="0.9"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></radialGradient><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="${transparent ? 0 : 0.45}"/></filter><mask id="m"><rect width="1024" height="1024" fill="#fff"/><line x1="512" y1="530" x2="512" y2="320" stroke="#000" stroke-width="46" stroke-linecap="round"/><line x1="512" y1="530" x2="659.22" y2="445" stroke="#000" stroke-width="46" stroke-linecap="round"/><circle cx="512" cy="530" r="23" fill="#000"/></mask></defs>`;
  if (mono) {
    // Android themed icon: one-colour silhouette (disc with the hands cut out, plus the dot).
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}<g fill="#fff"><circle cx="512" cy="530" r="340" mask="url(#m)"/><circle cx="762" cy="262" r="70"/></g></svg>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${bg}` +
    `<circle cx="512" cy="530" r="340" fill="${face}" filter="url(#s)"/>` +
    `<line x1="512" y1="530" x2="512" y2="320" stroke="${hands}" stroke-width="46" stroke-linecap="round"/>` +
    `<line x1="512" y1="530" x2="659.2243186433545" y2="445" stroke="${hands}" stroke-width="46" stroke-linecap="round"/>` +
    `<circle cx="512" cy="530" r="23" fill="${hands}"/>` +
    `<circle cx="762" cy="262" r="70" fill="${dot}" stroke="${bottom}" stroke-width="26"/></svg>`
  );
}

function render(svgText, outPng, size = 1024, transparent = false) {
  const base = path.join(SET, path.basename(outPng, '.png'));
  fs.writeFileSync(base + '.svg', svgText);
  const html = `<!doctype html><html><body style="margin:0;background:${transparent ? 'transparent' : '#000'}"><img src="file:///${base.replace(/\\/g, '/')}.svg" width="${size}" height="${size}" style="display:block"></body></html>`;
  fs.writeFileSync(base + '.html', html);
  for (let attempt = 0; attempt < 5; attempt++) {
    const profile = path.join(require('os').tmpdir(), 'edge-icons-' + process.pid + '-' + attempt);
    try {
      execFileSync(EDGE, ['--headless=new', '--no-first-run', '--user-data-dir=' + profile, '--virtual-time-budget=2000', '--disable-gpu', '--hide-scrollbars', ...(transparent ? ['--default-background-color=00000000'] : []), `--window-size=${size},${size}`, `--screenshot=${outPng}`, 'file:///' + base.replace(/\\/g, '/') + '.html'], { stdio: 'ignore', timeout: 60000 });
    } catch {
      /* retry below */
    }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Edge still releasing files; temp dir, harmless */ }
    if (fs.existsSync(outPng) && fs.statSync(outPng).size > 500) return;
    fs.rmSync(outPng, { force: true });
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},1500)']);
  }
  throw new Error('render failed: ' + outPng);
}

const only = process.argv[2]; // optional: render a single icon by name
for (const p of P) {
  if (only && p[0] !== only) continue;
  if (!only && fs.existsSync(path.join(ICONS, p[0] + '.png')) && !process.env.FORCE) continue;
  render(svg(p), path.join(ICONS, p[0] + '.png'));
  console.log('icon', p[0]);
}

// Default icon + Android + splash + small icons come from the default (navy) design.
const d = P[0];
if (!only || only === d[0]) {
  fs.copyFileSync(path.join(ICONS, 'StudentoNavy.png'), path.join(IMAGES, 'icon.png'));
  render(svg(d), path.join(IMAGES, 'favicon.png'), 64);
  // Android adaptive: background (gradient only) + foreground (clock on transparent) + monochrome.
  const bgOnly = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><radialGradient id="a" cx="0.5" cy="0.3" r="0.9"><stop offset="0" stop-color="${d[2]}"/><stop offset="1" stop-color="${d[3]}"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#a)"/></svg>`;
  render(bgOnly, path.join(IMAGES, 'android-icon-background.png'), 512);
  render(svg(d, { transparent: true }), path.join(IMAGES, 'android-icon-foreground.png'), 512, true);
  render(svg(d, { mono: true }), path.join(IMAGES, 'android-icon-monochrome.png'), 512, true);
  render(svg(d, { transparent: true }), path.join(IMAGES, 'splash-icon.png'), 512, true);
  render(svg(d, { mono: true }), path.join(IMAGES, 'notification-icon.png'), 96, true);
}
console.log('rendered; now run scripts/flatten-icons.ps1 to drop alpha from the opaque icons');
