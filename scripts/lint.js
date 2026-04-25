const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const sourceDirs = ['src'];
const ignoredDirs = new Set(['node_modules', '.next', '.git']);
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const bannedPatterns = [
  {
    pattern: /\.toISOString\(\)\.split\(['"]T['"]\)\[0\]/,
    message: 'Use toDateStr(date) for calendar dates instead of toISOString().split("T")[0].',
  },
];

const failures = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!extensions.has(path.extname(entry.name))) continue;
    lintFile(fullPath);
  }
}

function lintFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  for (const { pattern, message } of bannedPatterns) {
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        failures.push(`${path.relative(root, filePath)}:${index + 1} ${message}`);
      }
    });
  }
}

for (const dir of sourceDirs) {
  walk(path.join(root, dir));
}

if (failures.length > 0) {
  console.error('Lint failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Lint passed.');
