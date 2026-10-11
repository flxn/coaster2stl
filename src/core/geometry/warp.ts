import * as THREE from 'three';

/**
 * Bends flat shapes with a point mapping, e.g. a line of text onto a circle.
 * Outlines are densified first, so straight edges follow the curve instead of cutting across it.
 */
export const warpShapes = (
  shapes: THREE.Shape[],
  map: (x: number, y: number) => [number, number],
  maxSegment = 0.3,
  divisions = 8,
): THREE.Shape[] => {
  const densify = (points: THREE.Vector2[]) => {
    const result: THREE.Vector2[] = [];
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      const steps = Math.max(1, Math.ceil(point.distanceTo(next) / maxSegment));
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        result.push(new THREE.Vector2(point.x + (next.x - point.x) * t, point.y + (next.y - point.y) * t));
      }
    });
    return result.map((point) => new THREE.Vector2(...map(point.x, point.y)));
  };
  return shapes.map((shape) => {
    const { shape: outer, holes } = shape.extractPoints(divisions);
    const result = new THREE.Shape(densify(outer));
    holes.forEach((hole) => result.holes.push(new THREE.Path(densify(hole))));
    return result;
  });
};

export type ArcSide = 'top' | 'bottom';

/**
 * Maps a line laid out along X (centered on x = 0, baseline at y = 0) onto a circle of `radius`:
 * on the top the text reads clockwise with letters pointing outwards, on the bottom it reads
 * counter-clockwise with letters pointing inwards, so both stay upright.
 */
export const arcMapping = (radius: number, side: ArcSide, centerAngle = side === 'top' ? Math.PI / 2 : -Math.PI / 2) => (
  side === 'top'
    ? (x: number, y: number): [number, number] => {
      const angle = centerAngle - x / radius;
      const r = radius + y;
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    }
    : (x: number, y: number): [number, number] => {
      const angle = centerAngle + x / radius;
      const r = radius - y;
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    }
);
