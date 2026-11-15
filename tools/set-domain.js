const fs = require('fs');
const path = require('path');

const from = process.argv[2];
const to = process.argv[3];

if (!from || !to) {
  console.error('usage: node tools/set-domain.js <current-origin> <new-origin>');
  console.error('example: node tools/set-domain.js https://kapital-abl.pages.dev https://kapital.com');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const files = ['js/config.js', 'index.html', 'robots.txt', 'sitemap.xml', '_redirects'];

let changed = 0;
files.forEach((rel) => {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, 'utf8');
  if (src.indexOf(from) === -1) return;
  const next = src.split(from).join(to);
  fs.writeFileSync(file, next);
  changed += 1;
  console.log('updated ' + rel);
});

if (!changed) {
  console.log('no references to ' + from + ' found');
  process.exit(1);
}
