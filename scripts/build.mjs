import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/content/index.ts'], bundle: true, outfile: 'dist/content.js' });
await build({ entryPoints: ['src/background/index.ts'], bundle: true, outfile: 'dist/background.js' });
await cp('manifest.json', 'dist/manifest.json');
await cp('src/content/overlay.css', 'dist/overlay.css');
await cp('src/assets/icons', 'dist/icons', { recursive: true });
