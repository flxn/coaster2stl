import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ModelPart, ModelWarning, WarningParams } from '@/core/types';
import { cloneOptions } from '@/core/utils/options';
import { COASTER_SHAPES, PATTERNS } from './catalog';
import { expandStrokes } from './drawing';
import generateModel from './generator';
import { defaultOptions, normalizeOptions, type ToolOptions } from './options';
import { coasterOutline, inscribedRadius } from './outline';

const run = async (change: (options: ToolOptions) => void = () => {}) => {
  const options = cloneOptions(defaultOptions);
  change(options);
  const warnings: ModelWarning[] = [];
  const parts = await generateModel(options, {
    warn: (code: string, params?: WarningParams) => warnings.push({ code, params }),
  });
  return { parts, warnings, codes: warnings.map((warning) => warning.code) };
};

const box = (geometry: THREE.BufferGeometry) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
};
const part = (parts: ModelPart[], name: string) => parts.find((item) => item.name === name);
const triangles = (geometry: THREE.BufferGeometry) => geometry.getAttribute('position').count / 3;

describe('coaster outlines', () => {
  it.each(COASTER_SHAPES)('%s fits the configured size', (shape) => {
    const outline = coasterOutline(shape, 100, 8, 8);
    const bounds = new THREE.Box2();
    outline.forEach((item) => item.extractPoints(24).shape.forEach((point) => bounds.expandByPoint(point)));
    const size = bounds.getSize(new THREE.Vector2());
    // the width across never exceeds the size, and polygons may only be wider across their corners
    expect(Math.min(size.x, size.y)).toBeLessThanOrEqual(100.01);
    expect(Math.min(size.x, size.y)).toBeGreaterThan(92);
    expect(inscribedRadius(outline)).toBeGreaterThan(38);
  });
});

describe('coaster generator', () => {
  it('builds a raised coaster with rim, icon and curved text', async () => {
    const { parts, codes } = await run();
    expect(parts.map((item) => item.name)).toEqual(['base', 'design']);
    expect(codes).toEqual([]);
    const base = box(parts[0].geometry);
    expect(base.max.x - base.min.x).toBeCloseTo(100, 1);
    // plate plus rim
    expect(base.max.z).toBeCloseTo(4 + 1.2, 3);
    const design = box(part(parts, 'design')!.geometry);
    expect(design.min.z).toBeCloseTo(4, 3);
    expect(design.max.z).toBeCloseTo(5, 3);
    // the curved text reaches up to the rim but stays inside it
    expect(design.max.y).toBeGreaterThan(35);
    expect(design.max.y).toBeLessThan(47);
  });

  it.each(PATTERNS.filter((pattern) => pattern !== 'none'))('renders the %s pattern inside the coaster', async (pattern) => {
    const { parts } = await run((options) => {
      options.pattern.type = pattern;
    });
    const shapes = part(parts, 'pattern');
    expect(shapes, pattern).toBeDefined();
    const bounds = box(shapes!.geometry);
    expect(Math.max(-bounds.min.x, bounds.max.x, -bounds.min.y, bounds.max.y)).toBeLessThan(47);
  });

  it('turns drawn strokes with symmetry into a design', async () => {
    expect(expandStrokes([{ points: [0, 0.5, 0.2, 0.6], width: 0.05, erase: false }], 'kaleidoscope', 6)).toHaveLength(12);
    const { parts } = await run((options) => {
      options.artwork.source = 'none';
      options.text.top = '';
      options.drawing.strokes = [
        { points: [0, 0.3, 0.1, 0.5, 0.25, 0.6], width: 0.06, erase: false },
        { points: [0.1, 0.5], width: 0.03, erase: true },
      ];
      options.drawing.symmetry = 'radial';
      options.drawing.segments = 6;
    });
    const design = part(parts, 'design');
    expect(design).toBeDefined();
    expect(triangles(design!.geometry)).toBeGreaterThan(100);
  });

  it('cuts flush inlays for multi-color printing, face down without rim', async () => {
    const { parts, codes } = await run((options) => {
      options.print.relief = 'inlay';
      options.print.faceDown = true;
      options.pattern.type = 'dots';
      options.bottom.style = 'cork';
    });
    expect(parts.map((item) => item.name)).toEqual(['base', 'design', 'pattern']);
    expect(codes).toContain('rimFaceDown');
    expect(codes).toContain('faceDown');
    expect(codes).not.toContain('corkBridging');
    // everything is flat: the inlays sit in the bottom layer, the base is exactly the plate
    expect(box(parts[0].geometry).max.z).toBeCloseTo(4, 3);
    expect(box(part(parts, 'design')!.geometry).min.z).toBeCloseTo(0, 3);
    expect(box(part(parts, 'design')!.geometry).max.z).toBeCloseTo(1, 3);
  });

  it('shrinks text that does not fit and reports it', async () => {
    const { codes } = await run((options) => {
      options.text.top = 'THIS IS A REALLY LONG TEXT THAT DOES NOT FIT AROUND THE TOP OF THE COASTER';
      options.text.bottom = 'AND ANOTHER ONE FOR THE BOTTOM';
      options.text.center = 'Plus a long center line that is far too wide';
    });
    expect(codes).toContain('ringTextScaled');
    expect(codes).toContain('centerTextScaled');
  });

  it('limits pockets to keep a solid floor', async () => {
    const { codes } = await run((options) => {
      options.coaster.thickness = 2;
      options.print.relief = 'engraved';
      options.bottom.style = 'feet';
      options.bottom.depth = 2;
    });
    expect(codes).toContain('depthLimited');
  });

  it('repairs broken settings from outside', () => {
    const options = cloneOptions(defaultOptions) as unknown as Record<string, Record<string, unknown>>;
    options.coaster.shape = 'triangle';
    options.artwork.source = 'upload';
    options.drawing.strokes = [{ points: [0, 0, 'x'], width: 1 }, { points: [0, 0, 0.1, 0.1], width: 0.05 }];
    options.colors.base = 'red';
    normalizeOptions(options as unknown as ToolOptions);
    expect(options.coaster.shape).toBe('circle');
    expect(options.artwork.source).toBe('none');
    expect(options.drawing.strokes).toHaveLength(1);
    expect(options.colors.base).toBe(defaultOptions.colors.base);
  });
});
