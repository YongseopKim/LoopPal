import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const overlayCssPath = join(process.cwd(), 'src/content/overlay.css');

describe('overlay.css', () => {
  it('defines both inline panel and fixed fallback root styles', () => {
    const css = readFileSync(overlayCssPath, 'utf8');

    expect(css).toContain('[data-bp-overlay-root][data-bp-overlay-mode="inline"]');
    expect(css).toContain('margin: 16px 0 0;');
    expect(css).toContain('[data-bp-overlay-root][data-bp-overlay-mode="fixed"]');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('z-index: 2147483647;');
  });
});
