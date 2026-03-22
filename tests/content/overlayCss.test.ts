import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const overlayCssPath = join(process.cwd(), 'src/content/overlay.css');

describe('overlay.css', () => {
  it('pins the overlay root above the page content', () => {
    const css = readFileSync(overlayCssPath, 'utf8');

    expect(css).toContain('[data-bp-overlay-root]');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('z-index: 2147483647;');
  });
});
