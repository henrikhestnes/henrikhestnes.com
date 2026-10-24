import { cp, mkdir, rm } from 'node:fs/promises';

// Publish only the homepage assets, never backend source, tests or local files.
const files = [
  'index.html', 'style.css', 'scene.js', 'shark-motion.js', 'guestbook.js',
  'poster.jpg', 'og.jpg', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png',
  'snow-print.svg', 'norway.svg', 'brazil.svg',
  'fonts/BricolageGrotesque.woff2', 'fonts/LICENSE.md',
];
const root = new URL('./', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(new URL('fonts/', output), { recursive: true });
await Promise.all(files.map(file => cp(new URL(file, root), new URL(file, output))));
console.log(`Built ${files.length} public assets in dist/`);
