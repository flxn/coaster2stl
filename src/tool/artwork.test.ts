import { describe, expect, it } from 'vitest';
import { suggestThreshold, traceImage } from './artwork';

/** A white image with a black disc and a white hole in the middle. */
const ring = (size = 120): ImageData => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - size / 2, y - size / 2);
      const dark = distance < size * 0.4 && distance > size * 0.15;
      data.set([dark ? 20 : 240, dark ? 20 : 240, dark ? 20 : 240, 255], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data, colorSpace: 'srgb' } as ImageData;
};

describe('image tracing', () => {
  it('finds a threshold between the dark and light parts', () => {
    const threshold = suggestThreshold(ring());
    expect(threshold).toBeGreaterThan(20);
    expect(threshold).toBeLessThan(240);
  });

  it('traces a ring with its hole as smooth polygons', () => {
    const art = traceImage(ring(), { threshold: 128, invert: false }, 'ring.png');
    expect(art.polygons).toHaveLength(1);
    expect(art.polygons[0].holes).toHaveLength(1);
    expect(art.width).toBeCloseTo(1000, -1);
    expect(art.height).toBeCloseTo(1000, -1);
    // smoothing and simplification keep it far below the pixel count of the outline
    expect(art.polygons[0].outer.length / 2).toBeLessThan(400);
  });

  it('can use the light parts instead', () => {
    const art = traceImage(ring(), { threshold: 128, invert: true }, 'ring.png');
    // the background and the center disc
    expect(art.polygons.length).toBe(2);
  });
});
