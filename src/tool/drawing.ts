import type { DrawingStroke, Symmetry } from './options';

/**
 * Symmetry of the sketchpad, shared by the canvas (UI) and the generator, so what you draw is exactly
 * what gets printed. Points are relative to the design radius (-1…1, Y up).
 */

type Transform = (x: number, y: number) => [number, number];

export const symmetryTransforms = (symmetry: Symmetry, segments: number): Transform[] => {
  const identity: Transform = (x, y) => [x, y];
  const mirror: Transform = (x, y) => [-x, y];
  if (symmetry === 'mirror') {
    return [identity, mirror];
  }
  if (symmetry === 'radial' || symmetry === 'kaleidoscope') {
    const count = Math.max(2, Math.min(24, Math.round(segments) || 2));
    const rotations: Transform[] = Array.from({ length: count }, (_, i) => {
      const angle = (i * 2 * Math.PI) / count;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return (x, y) => [x * cos - y * sin, x * sin + y * cos];
    });
    if (symmetry === 'radial') {
      return rotations;
    }
    return rotations.flatMap((rotate) => [rotate, (x: number, y: number) => rotate(...mirror(x, y))]);
  }
  return [identity];
};

/**
 * Every stroke with all its symmetric copies, in drawing order (an eraser stroke erases all copies
 * of what was drawn before it).
 */
export const expandStrokes = (strokes: DrawingStroke[], symmetry: Symmetry, segments: number): DrawingStroke[] => {
  const transforms = symmetryTransforms(symmetry, segments);
  return strokes.flatMap((stroke) => transforms.map((transform) => {
    const points: number[] = [];
    for (let i = 0; i + 1 < stroke.points.length; i += 2) {
      points.push(...transform(stroke.points[i], stroke.points[i + 1]));
    }
    return { ...stroke, points };
  }));
};
