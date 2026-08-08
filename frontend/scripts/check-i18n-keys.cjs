/**
 * Finds t('key') calls that pass NO default string and whose key is absent from
 * en.json — those render the raw key to the user (the `dashboard.quickLinks.*` bug).
 * t('key', 'Default') is safe: i18next renders the default when the key is missing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const en = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/locales/en.json'), 'utf8'));

const has = (key) =>
  key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), en) !== undefined;

// t('some.key')  — closing paren immediately after the quoted key means no default arg.
const NO_DEFAULT = /\bt\(\s*'([A-Za-z0-9_.]+)'\s*\)/g;

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
};

const missing = new Map();
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(NO_DEFAULT)) {
    const key = m[1];
    if (key.includes('.') && !has(key)) {
      const rel = path.relative(ROOT, file);
      if (!missing.has(key)) missing.set(key, new Set());
      missing.get(key).add(rel);
    }
  }
}

console.log(`MISSING KEYS WITH NO FALLBACK: ${missing.size}\n`);
[...missing.entries()].sort().forEach(([key, files]) => {
  console.log(`  ${key}`);
  console.log(`      ${[...files].join(', ')}`);
});

// Non-zero exit so this can gate CI.
if (missing.size > 0) process.exitCode = 1;
