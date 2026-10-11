import * as THREE from 'three';

export interface GridOptions {
  columns: number;
  rows: number;
  /** whether the cell in column c, row r (row 0 at the top) is solid */
  filled: (column: number, row: number) => boolean;
  /** cell size in mm */
  cell: number;
  /** world coordinates of the grid's top left corner */
  left: number;
  top: number;
  /** rounds outer and inner corners, as a fraction of the cell size (0 = square, 0.5 = fully round) */
  cornerRadius?: number;
}

type Point = [number, number];

/**
 * Traces the outlines of the filled cells of a grid (e.g. QR code modules) into shapes with holes.
 * Neighbouring cells merge into one outline, so the result is watertight when extruded
 * and has far fewer triangles than one box per cell. Cells that only touch at a corner stay separate.
 */
export const gridToShapes = ({
  columns, rows, filled, cell, left, top, cornerRadius = 0,
}: GridOptions): THREE.Shape[] => {
  const isFilled = (c: number, r: number) => c >= 0 && r >= 0 && c < columns && r < rows && filled(c, r);

  // directed boundary edges with the filled cell on the left (grid coordinates: x right, y down)
  const outgoing = new Map<string, Point[]>();
  const key = (x: number, y: number) => `${x},${y}`;
  const addEdge = (from: Point, to: Point) => {
    const list = outgoing.get(key(...from));
    if (list) list.push(to); else outgoing.set(key(...from), [to]);
  };
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      if (!isFilled(c, r)) continue;
      // with y pointing down, walking counter-clockwise on screen keeps the cell on the left
      if (!isFilled(c, r - 1)) addEdge([c + 1, r], [c, r]);
      if (!isFilled(c - 1, r)) addEdge([c, r], [c, r + 1]);
      if (!isFilled(c, r + 1)) addEdge([c, r + 1], [c + 1, r + 1]);
      if (!isFilled(c + 1, r)) addEdge([c + 1, r + 1], [c + 1, r]);
    }
  }

  const loops: Point[][] = [];
  while (outgoing.size) {
    const [startKey, targets] = outgoing.entries().next().value as [string, Point[]];
    const start = startKey.split(',').map(Number) as Point;
    const loop: Point[] = [start];
    let current = start;
    let next = targets.shift()!;
    if (!targets.length) outgoing.delete(startKey);
    let direction: Point = [next[0] - current[0], next[1] - current[1]];
    while (next[0] !== start[0] || next[1] !== start[1]) {
      current = next;
      loop.push(current);
      const options = outgoing.get(key(...current))!;
      if (options.length > 1) {
        // at a corner where two cells touch diagonally, turn towards the current cell
        // (left on screen = the cross product decides) so they stay separate outlines
        options.sort((a, b) => {
          const turn = (p: Point) => direction[0] * (p[1] - current[1]) - direction[1] * (p[0] - current[0]);
          return turn(a) - turn(b);
        });
      }
      next = options.shift()!;
      if (!options.length) outgoing.delete(key(...current));
      direction = [next[0] - current[0], next[1] - current[1]];
    }
    loops.push(loop);
  }

  // drop points in the middle of straight runs
  const simplify = (loop: Point[]) => loop.filter((point, index) => {
    const prev = loop[(index - 1 + loop.length) % loop.length];
    const next = loop[(index + 1) % loop.length];
    return (point[0] - prev[0]) * (next[1] - point[1]) !== (point[1] - prev[1]) * (next[0] - point[0]);
  });

  const toWorld = (loop: Point[]) => loop.map(([x, y]) => new THREE.Vector2(left + x * cell, top - y * cell));
  // signed area in world space (Y up): outlines are counter-clockwise, holes clockwise
  const area = (points: THREE.Vector2[]) => points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;

  /** the loop as a path; with a corner radius, every corner (convex or concave) becomes a curve */
  const trace = <T extends THREE.Path>(path: T, points: THREE.Vector2[]): T => {
    const radius = Math.min(0.5, Math.max(0, cornerRadius)) * cell;
    if (radius <= 0) {
      path.setFromPoints(points);
      return path;
    }
    const corner = (index: number) => {
      const point = points[index];
      const before = points[(index - 1 + points.length) % points.length];
      const after = points[(index + 1) % points.length];
      return {
        point,
        start: point.clone().add(before.clone().sub(point).setLength(radius)),
        end: point.clone().add(after.clone().sub(point).setLength(radius)),
      };
    };
    const first = corner(0);
    path.moveTo(first.end.x, first.end.y);
    for (let i = 1; i <= points.length; i += 1) {
      const { point, start, end } = corner(i % points.length);
      path.lineTo(start.x, start.y);
      path.quadraticCurveTo(point.x, point.y, end.x, end.y);
    }
    return path;
  };

  const outlines: { points: THREE.Vector2[]; area: number; shape: THREE.Shape }[] = [];
  const holes: THREE.Vector2[][] = [];
  loops.map(simplify).map(toWorld).forEach((points) => {
    const signed = area(points);
    if (signed > 0) {
      outlines.push({ points, area: signed, shape: trace(new THREE.Shape(), points) });
    } else {
      holes.push(points);
    }
  });

  const contains = (polygon: THREE.Vector2[], x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  };

  holes.forEach((hole) => {
    // a point just inside the hole: the middle of its first edge, moved a quarter cell into the empty side
    const [a, b] = hole;
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const x = (a.x + b.x) / 2 - dy * cell * 0.25;
    const y = (a.y + b.y) / 2 + dx * cell * 0.25;
    const owner = outlines
      .filter((outline) => contains(outline.points, x, y))
      .sort((p, q) => p.area - q.area)[0];
    owner?.shape.holes.push(trace(new THREE.Path(), hole));
  });

  return outlines.map((outline) => outline.shape);
};
