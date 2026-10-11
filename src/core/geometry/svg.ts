import type * as THREE from 'three';
import svgpath from 'svgpath';
import type { PathCommand } from 'opentype.js';
import { shapesFromCommands } from './text';

export interface Rect {
  /** world coordinates (Y up) of the lower left corner */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts SVG path data (`d`) into shapes that fill `target`, keeping the aspect ratio and centering.
 * Works without a DOM, so it can run in the model worker.
 */
export const shapesFromPathData = (
  d: string,
  target: Rect,
  viewBox: [number, number, number, number] = [0, 0, 24, 24],
): THREE.Shape[] => {
  const [vx, vy, vw, vh] = viewBox;
  const scale = Math.min(target.width / vw, target.height / vh);
  const offsetX = target.x + (target.width - vw * scale) / 2;
  const top = target.y + target.height - (target.height - vh * scale) / 2;

  const commands: PathCommand[] = [];
  svgpath(d).abs().unshort().unarc().iterate((segment, _index, x, y) => {
    const [type, ...values] = segment as [string, ...number[]];
    switch (type) {
      case 'M':
      case 'L':
        commands.push({ type, x: values[0], y: values[1] });
        break;
      case 'H':
        commands.push({ type: 'L', x: values[0], y });
        break;
      case 'V':
        commands.push({ type: 'L', x, y: values[0] });
        break;
      case 'Q':
        commands.push({ type: 'Q', x1: values[0], y1: values[1], x: values[2], y: values[3] });
        break;
      case 'C':
        commands.push({ type: 'C', x1: values[0], y1: values[1], x2: values[2], y2: values[3], x: values[4], y: values[5] });
        break;
      case 'Z':
        commands.push({ type: 'Z' });
        break;
      default:
        break;
    }
  });
  return shapesFromCommands(commands, (px, py) => [offsetX + (px - vx) * scale, top - (py - vy) * scale]);
};

/** A polygon with holes; coordinates are flat [x0, y0, x1, y1, …] lists with Y pointing down. */
export interface PolygonData {
  outer: number[];
  holes: number[][];
}

const ringCommands = (points: number[]): PathCommand[] => {
  const commands: PathCommand[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    commands.push({ type: i === 0 ? 'M' : 'L', x: points[i], y: points[i + 1] });
  }
  commands.push({ type: 'Z' });
  return commands;
};

/** Shapes from polygons in a 0…width × 0…height space (e.g. an uploaded logo), fitted into `target`. */
export const shapesFromPolygons = (polygons: PolygonData[], size: { width: number; height: number }, target: Rect) => {
  const scale = Math.min(target.width / size.width, target.height / size.height);
  const offsetX = target.x + (target.width - size.width * scale) / 2;
  const top = target.y + target.height - (target.height - size.height * scale) / 2;
  const transform = (px: number, py: number): [number, number] => [offsetX + px * scale, top - py * scale];
  // even-odd within each polygon (the winding of uploaded paths is unknown); separate polygons may overlap
  return polygons.flatMap((polygon) => shapesFromCommands(
    [polygon.outer, ...polygon.holes].flatMap(ringCommands),
    transform,
    'evenodd',
  ));
};
