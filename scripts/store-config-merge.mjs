// Builds the App Store metadata file EAS pushes, from the committed store.config.json plus the
// gitignored store.config.local.json (reviewer phone and anything else that must stay out of the
// public repo). Output: .eas-metadata/store.config.json (gitignored).
//   node scripts/store-config-merge.mjs && npx eas-cli@latest metadata:push --profile production
import fs from 'node:fs';

const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] ?? {}, v) : v;
  return out;
};
const base = JSON.parse(fs.readFileSync('store.config.json', 'utf8'));
const local = fs.existsSync('store.config.local.json') ? JSON.parse(fs.readFileSync('store.config.local.json', 'utf8')) : {};
if (!local.apple?.review?.phone) console.warn('store.config.local.json has no apple.review.phone: the reviewer phone will be the placeholder.');
fs.mkdirSync('.eas-metadata', { recursive: true });
fs.writeFileSync('.eas-metadata/store.config.json', JSON.stringify(merge(base, local), null, 2) + '\n');
console.log('wrote .eas-metadata/store.config.json');
