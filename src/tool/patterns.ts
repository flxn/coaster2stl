import * as THREE from 'three';
import { offsetShapes, strokesToShapes, unionShapes } from '@/core/geometry/polygons';
import { circlePath, circleShape, ringShape } from '@/core/geometry/shapes';
import type { PatternId } from './catalog';

export interface PatternOptions {
  /** the pattern covers at least a circle of this radius around the origin */
  radius: number;
  spacing: number;
  weight: number;
  /** degrees */
  rotation: number;
  seed: number;
}

/** Small deterministic random generator, so the same seed always gives the same terrazzo. */
export const seededRandom = (seed: number) => {
  let state = (Math.floor(seed) * 2654435761) >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const polygon = (points: [number, number][]) => new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));

const hexagon = (cx: number, cy: number, r: number) => polygon(Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i;
  return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as [number, number];
}));

const rotateShapes = (shapes: THREE.Shape[], degrees: number) => {
  if (!degrees) {
    return shapes;
  }
  const matrix = new THREE.Matrix3().makeRotation(THREE.MathUtils.degToRad(degrees));
  const rotate = (points: THREE.Vector2[]) => points.map((point) => point.clone().applyMatrix3(matrix));
  return shapes.map((shape) => {
    const { shape: outer, holes } = shape.extractPoints(12);
    const result = new THREE.Shape(rotate(outer));
    holes.forEach((hole) => result.holes.push(new THREE.Path(rotate(hole))));
    return result;
  });
};

/**
 * Decorative background shapes, larger than the coaster; the generator clips them to the design area
 * and keeps them away from the artwork and text.
 */
export const patternShapes = (type: PatternId, {
  radius, spacing, weight, rotation, seed,
}: PatternOptions): THREE.Shape[] => {
  const s = Math.max(2, spacing);
  const w = Math.max(0.4, Math.min(weight, s * 0.8));
  // a little larger than the coaster, so rotated patterns still cover it
  const r = radius * 1.45;
  const steps = Math.ceil(r / s);

  switch (type) {
    case 'rings': {
      const shapes: THREE.Shape[] = [];
      for (let k = 1; k * s - w / 2 < radius; k += 1) {
        shapes.push(ringShape(circleShape(k * s + w / 2), circlePath(Math.max(0.01, k * s - w / 2))));
      }
      return shapes;
    }
    case 'dots': {
      const shapes: THREE.Shape[] = [];
      const rowHeight = (s * Math.sqrt(3)) / 2;
      for (let row = -steps * 2; row <= steps * 2; row += 1) {
        const y = row * rowHeight;
        if (Math.abs(y) > r) continue;
        for (let col = -steps; col <= steps; col += 1) {
          const x = col * s + (row % 2 ? s / 2 : 0);
          if (Math.hypot(x, y) < r) shapes.push(circleShape(w, x, y));
        }
      }
      return rotateShapes(shapes, rotation);
    }
    case 'honeycomb': {
      const cell = s / Math.sqrt(3);
      const shapes: THREE.Shape[] = [];
      for (let col = -steps * 2; col <= steps * 2; col += 1) {
        const x = col * cell * 1.5;
        if (Math.abs(x) > r) continue;
        for (let row = -steps; row <= steps; row += 1) {
          const y = row * s + (col % 2 ? s / 2 : 0);
          if (Math.hypot(x, y) > r) continue;
          const outer = hexagon(x, y, cell + w / 2);
          outer.holes.push(new THREE.Path(hexagon(x, y, Math.max(0.05, cell - w / 2)).getPoints()));
          shapes.push(outer);
        }
      }
      return rotateShapes(unionShapes(shapes, 1), rotation);
    }
    case 'waves': {
      const amplitude = s * 0.22;
      const wavelength = s * 2.4;
      const lines = [];
      for (let k = -steps; k <= steps; k += 1) {
        const points: THREE.Vector2[] = [];
        for (let x = -r; x <= r; x += 0.8) {
          points.push(new THREE.Vector2(x, k * s + amplitude * Math.sin((2 * Math.PI * x) / wavelength)));
        }
        lines.push({ points, width: w });
      }
      return rotateShapes(strokesToShapes(lines), rotation);
    }
    case 'sunburst': {
      const count = Math.min(96, Math.max(8, Math.round((Math.PI * radius) / s) * 2));
      const step = (2 * Math.PI) / count;
      const shapes: THREE.Shape[] = [];
      for (let i = 0; i < count; i += 2) {
        const a = i * step + THREE.MathUtils.degToRad(rotation);
        shapes.push(polygon([[0, 0], [Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a + step) * r, Math.sin(a + step) * r]]));
      }
      // a small solid center, so the rays do not meet in a needle-thin point
      return unionShapes([...shapes, circleShape(Math.max(w, s * 0.3))]);
    }
    case 'checker': {
      const shapes: THREE.Shape[] = [];
      for (let row = -steps; row <= steps; row += 1) {
        for (let col = -steps; col <= steps; col += 1) {
          if ((row + col) % 2 === 0) {
            const x = col * s;
            const y = row * s;
            shapes.push(polygon([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]));
          }
        }
      }
      // slightly overlapping corners would be non-manifold, so the squares are separated by a hair
      return rotateShapes(offsetShapes(shapes, -0.05), rotation);
    }
    case 'terrazzo': {
      const random = seededRandom(seed);
      const count = Math.round((Math.PI * radius * radius) / (s * s) * 0.9);
      const chips: THREE.Shape[] = [];
      for (let i = 0; i < count; i += 1) {
        const distance = Math.sqrt(random()) * radius;
        const angle = random() * Math.PI * 2;
        const cx = Math.cos(angle) * distance;
        const cy = Math.sin(angle) * distance;
        const size = w * (0.8 + random() * 1.6);
        const corners = 5 + Math.floor(random() * 4);
        const spin = random() * Math.PI * 2;
        chips.push(polygon(Array.from({ length: corners }, (_, k) => {
          const a = spin + (k / corners) * Math.PI * 2;
          const rr = size * (0.55 + random() * 0.6);
          return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * (0.6 + random() * 0.5)] as [number, number];
        })));
      }
      // soften the chips a little, like polished stone
      return offsetShapes(offsetShapes(chips, -Math.min(0.3, w * 0.15)), Math.min(0.3, w * 0.15));
    }
    case 'none':
    default:
      return [];
  }
};
