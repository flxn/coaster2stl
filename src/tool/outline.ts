import * as THREE from 'three';
import { offsetShapes, unionShapes } from '@/core/geometry/polygons';
import { circleShape, roundedRectShape } from '@/core/geometry/shapes';
import type { CoasterShape } from './catalog';

/** Allowed lobe counts and the default per lobed shape. */
export const LOBE_RANGES: Record<'flower' | 'scallop' | 'gear', { min: number; max: number; default: number }> = {
  flower: { min: 4, max: 12, default: 8 },
  scallop: { min: 10, max: 40, default: 20 },
  gear: { min: 8, max: 36, default: 16 },
};

const clampLobes = (shape: keyof typeof LOBE_RANGES, lobes: number) => {
  const range = LOBE_RANGES[shape];
  return Math.round(Math.min(range.max, Math.max(range.min, Number.isFinite(lobes) ? lobes : range.default)));
};

/** Rounds the convex corners of shapes (shrink, then grow by the radius). */
const roundConvex = (shapes: THREE.Shape[], radius: number) => (radius > 0.05 ? offsetShapes(offsetShapes(shapes, -radius), radius) : shapes);
/** Rounds the concave corners (grow, then shrink). */
const roundConcave = (shapes: THREE.Shape[], radius: number) => (radius > 0.05 ? offsetShapes(offsetShapes(shapes, radius), -radius) : shapes);

/** Regular polygon with a flat top edge whose inscribed circle has `apothem` as radius. */
const polygonShape = (sides: number, apothem: number) => {
  const circumradius = apothem / Math.cos(Math.PI / sides);
  const offset = Math.PI / 2 + Math.PI / sides;
  const points = Array.from({ length: sides }, (_, i) => {
    const angle = offset + (i * 2 * Math.PI) / sides;
    return new THREE.Vector2(Math.cos(angle) * circumradius, Math.sin(angle) * circumradius);
  });
  return new THREE.Shape(points);
};

/** Circles of `radius` at `distance` from the center, evenly around it (petals, bumps). */
const ringOfCircles = (count: number, distance: number, radius: number) => Array.from({ length: count }, (_, i) => {
  const angle = Math.PI / 2 + (i * 2 * Math.PI) / count;
  return circleShape(radius, Math.cos(angle) * distance, Math.sin(angle) * distance);
});

/**
 * The outline of the coaster, centered on the origin. `size` is the width across (the diameter of round
 * shapes, the width across the flats of polygons, the tips of flowers and gears), so a mug always fits.
 */
export const coasterOutline = (shape: CoasterShape, size: number, cornerRadius: number, lobes: number): THREE.Shape[] => {
  const half = size / 2;
  const corner = Math.max(0, Math.min(cornerRadius, half * 0.6));
  switch (shape) {
    case 'square':
      return [roundedRectShape(size, size, corner)];
    case 'hexagon':
      return roundConvex([polygonShape(6, half)], corner);
    case 'octagon':
      return roundConvex([polygonShape(8, half)], corner);
    case 'flower': {
      const count = clampLobes('flower', lobes);
      const petal = (half * 1.18 * Math.sin(Math.PI / count)) / (1 + 1.18 * Math.sin(Math.PI / count));
      const distance = half - petal;
      return roundConcave(unionShapes([circleShape(distance), ...ringOfCircles(count, distance, petal)], 16), half * 0.04);
    }
    case 'scallop': {
      const count = clampLobes('scallop', lobes);
      const bump = (half * Math.sin(Math.PI / count)) / (1 + Math.sin(Math.PI / count));
      const distance = half - bump;
      return roundConcave(unionShapes([circleShape(distance), ...ringOfCircles(count, distance, bump)], 16), bump * 0.25);
    }
    case 'gear': {
      const count = clampLobes('gear', lobes);
      const depth = Math.min(half * 0.1, (Math.PI * half) / count * 0.7);
      const root = half - depth;
      const step = (2 * Math.PI) / count;
      const points: THREE.Vector2[] = [];
      for (let i = 0; i < count; i += 1) {
        const start = Math.PI / 2 + i * step - step / 2;
        // root, flank up, tooth top, flank down: the tooth is a bit narrower at the tip
        [[0, root], [0.2, half], [0.5, half], [0.7, root]].forEach(([t, r]) => {
          const angle = start + t * step;
          points.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
        });
      }
      return roundConcave(roundConvex([new THREE.Shape(points)], Math.max(0.6, corner * 0.15)), Math.max(0.6, corner * 0.15));
    }
    case 'circle':
    default:
      return [circleShape(half)];
  }
};

/** Radius of the largest circle around the origin that fits inside the shapes (where ring text can go). */
export const inscribedRadius = (shapes: THREE.Shape[]): number => {
  let radius = Infinity;
  shapes.forEach((shape) => {
    const { shape: outer } = shape.extractPoints(24);
    outer.forEach((point, index) => {
      const next = outer[(index + 1) % outer.length];
      // distance from the origin to the segment
      const segment = next.clone().sub(point);
      const t = Math.max(0, Math.min(1, -point.dot(segment) / Math.max(segment.lengthSq(), 1e-12)));
      radius = Math.min(radius, point.clone().addScaledVector(segment, t).length());
    });
  });
  return Number.isFinite(radius) ? radius : 0;
};
