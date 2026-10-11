import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { loadFont } from './fonts';
import { gridToShapes } from './grid';
import { shapesFromPathData } from './svg';
import { measureText, textShapes } from './text';
import { mirrorShapesX, subtractShapes, unionShapes } from './polygons';
import { roundedRectShape } from './shapes';

const bounds = (shapes: THREE.Shape[]) => {
  const box = new THREE.Box2();
  shapes.forEach((shape) => shape.getPoints().forEach((point) => box.expandByPoint(point)));
  return box;
};

describe('gridToShapes', () => {
  const grid = (rows: string[]) => gridToShapes({
    columns: rows[0].length,
    rows: rows.length,
    filled: (c, r) => rows[r][c] === '#',
    cell: 1,
    left: 0,
    top: 0,
  });

  it('merges neighbouring cells into one outline', () => {
    const shapes = grid(['##', '##']);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].getPoints()).toHaveLength(4);
  });

  it('keeps diagonal cells separate', () => {
    expect(grid(['#.', '.#'])).toHaveLength(2);
  });

  it('turns enclosed empty cells into holes', () => {
    const shapes = grid(['###', '#.#', '###']);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
  });

  it('rounds corners without changing the outer size', () => {
    const [square] = gridToShapes({
      columns: 2, rows: 2, filled: () => true, cell: 1, left: 0, top: 2, cornerRadius: 0.5,
    });
    const box = bounds([square]);
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(2);
    // the corner itself is cut off
    expect(square.getPoints().some((point) => point.x < 1e-6 && point.y > 2 - 1e-6)).toBe(false);
  });

  it('assigns holes to the innermost outline', () => {
    const shapes = grid(['#####', '#...#', '#.#.#', '#...#', '#####']);
    expect(shapes).toHaveLength(2);
    expect(shapes.map((shape) => shape.holes.length).sort()).toEqual([0, 1]);
  });
});

describe('text', () => {
  it('sizes text by cap height', async () => {
    const font = await loadFont('inter', 'bold');
    const shapes = textShapes(font, 'H', { family: 'inter', weight: 'bold', size: 5 }, 0, 0);
    const box = bounds(shapes);
    expect(box.max.y - box.min.y).toBeCloseTo(5, 1);
    expect(box.min.y).toBeCloseTo(0, 1);
  });

  it('adds letter spacing to the width', async () => {
    const font = await loadFont('montserrat', 'regular');
    const style = { family: 'montserrat' as const, weight: 'regular' as const, size: 3 };
    expect(measureText(font, 'ABC', { ...style, letterSpacing: 0.2 })).toBeGreaterThan(measureText(font, 'ABC', style));
  });

  it('resolves self-intersecting glyph outlines', async () => {
    // Inter's "v" crosses itself at the bottom of the notch
    const font = await loadFont('inter', 'bold');
    const shapes = textShapes(font, 'v', { family: 'inter', weight: 'bold', size: 10 }, 0, 0);
    const box = bounds(shapes);
    const inside = (points: THREE.Vector2[], x: number, y: number) => {
      let result = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const a = points[i];
        const b = points[j];
        if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) result = !result;
      }
      return result;
    };
    // the top middle of the "v" is the empty notch between its arms
    const x = (box.min.x + box.max.x) / 2;
    const y = box.max.y - (box.max.y - box.min.y) * 0.1;
    expect(shapes.some((shape) => inside(shape.getPoints(), x, y))).toBe(false);
    expect(shapes).toHaveLength(1);
  });

  it('keeps the holes of letters', async () => {
    const font = await loadFont('playfair', 'regular');
    const shapes = textShapes(font, 'o', { family: 'playfair', weight: 'regular', size: 4 }, 0, 0);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
  });
});

describe('svg paths', () => {
  it('fits a path into the target rectangle', () => {
    // a 24×24 square with a square hole
    const shapes = shapesFromPathData('M2 2H22V22H2ZM8 8V16H16V8Z', {
      x: 10, y: 10, width: 6, height: 6,
    });
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
    const box = bounds(shapes);
    expect(box.min.x).toBeCloseTo(10.5);
    expect(box.max.y).toBeCloseTo(15.5);
  });
});

describe('polygons', () => {
  const square = (size: number, x = 0, y = 0) => roundedRectShape(size, size, 0, x, y);

  it('merges overlapping shapes', () => {
    const merged = unionShapes([square(2), square(2, 1, 0)]);
    expect(merged).toHaveLength(1);
    const box = bounds(merged);
    expect(box.max.x - box.min.x).toBeCloseTo(3);
  });

  it('cuts holes and keeps islands', () => {
    // a ring cut into a plate leaves the plate (with a hole) and the island in the middle
    const ring = roundedRectShape(6, 6);
    ring.holes.push(roundedRectShape(2, 2));
    const result = subtractShapes([square(10)], [ring]);
    expect(result).toHaveLength(2);
    expect(result.map((shape) => shape.holes.length).sort()).toEqual([0, 1]);
  });

  it('mirrors along X', () => {
    const mirrored = mirrorShapesX([square(2, 3, 0)]);
    expect(bounds(mirrored).max.x).toBeCloseTo(-2);
    expect(THREE.ShapeUtils.isClockWise(mirrored[0].getPoints())).toBe(THREE.ShapeUtils.isClockWise(square(2, 3, 0).getPoints()));
  });
});
