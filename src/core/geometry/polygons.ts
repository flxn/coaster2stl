import ClipperLib from 'clipper-lib';
import * as THREE from 'three';

/**
 * 2D boolean operations on shapes (Clipper, integer coordinates at 0.1 µm).
 * Flat parts with cut-outs (engraving, inlays, stencils) are built by cutting the outlines in 2D
 * and extruding the result, which is orders of magnitude faster than 3D CSG.
 */

const SCALE = 10000;

type Path = ClipperLib.IntPoint[];

const toPath = (points: THREE.Vector2[], clockwise: boolean): Path => {
  const path = points.map((point) => ({ X: Math.round(point.x * SCALE), Y: Math.round(point.y * SCALE) }));
  if (ClipperLib.Clipper.Orientation(path) === clockwise) {
    path.reverse();
  }
  return path;
};

const fromPath = (path: Path) => path.map((point) => new THREE.Vector2(point.X / SCALE, point.Y / SCALE));

/** Outer contours counter-clockwise, holes clockwise, so overlapping shapes union correctly (non-zero). */
const shapesToPaths = (shapes: THREE.Shape[], divisions: number): Path[] => shapes.flatMap((shape) => {
  const { shape: outer, holes } = shape.extractPoints(divisions);
  return [toPath(outer, false), ...holes.map((hole) => toPath(hole, true))];
});

const treeToShapes = (tree: ClipperLib.PolyTree): THREE.Shape[] => {
  const shapes: THREE.Shape[] = [];
  const visit = (node: ClipperLib.PolyNode) => {
    node.Childs().forEach((outer) => {
      const shape = new THREE.Shape(fromPath(outer.Contour()));
      outer.Childs().forEach((hole) => {
        shape.holes.push(new THREE.Path(fromPath(hole.Contour())));
        // islands inside the hole become shapes of their own
        visit(hole);
      });
      shapes.push(shape);
    });
  };
  visit(tree);
  return shapes;
};

const execute = (type: ClipperLib.ClipType, subject: Path[], clip: Path[]): THREE.Shape[] => {
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  if (clip.length) {
    clipper.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  }
  const tree = new ClipperLib.PolyTree();
  clipper.Execute(type, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return treeToShapes(tree);
};

/**
 * Filled area of closed outlines under a fill rule, as clean shapes. Self-intersecting or overlapping
 * outlines (common in fonts derived from variable fonts) are resolved correctly; the winding is kept,
 * because the non-zero rule depends on it.
 */
export const ringsToShapes = (rings: THREE.Vector2[][], fillRule: 'nonzero' | 'evenodd' = 'nonzero'): THREE.Shape[] => {
  const paths = rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.map((point) => ({ X: Math.round(point.x * SCALE), Y: Math.round(point.y * SCALE) })));
  if (!paths.length) {
    return [];
  }
  const fill = fillRule === 'evenodd' ? ClipperLib.PolyFillType.pftEvenOdd : ClipperLib.PolyFillType.pftNonZero;
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctUnion, tree, fill, fill);
  return treeToShapes(tree);
};

/** Merges overlapping shapes into clean, non-overlapping shapes. */
export const unionShapes = (shapes: THREE.Shape[], divisions = 12): THREE.Shape[] => (
  shapes.length ? execute(ClipperLib.ClipType.ctUnion, shapesToPaths(shapes, divisions), []) : []
);

/** `subject` with every shape of `cut` removed. */
export const subtractShapes = (subject: THREE.Shape[], cut: THREE.Shape[], divisions = 12): THREE.Shape[] => (
  execute(ClipperLib.ClipType.ctDifference, shapesToPaths(subject, divisions), shapesToPaths(cut, divisions))
);

/** Mirrors shapes along X (e.g. for designs printed face down on the bed). */
export const mirrorShapesX = (shapes: THREE.Shape[], divisions = 12): THREE.Shape[] => shapes.map((shape) => {
  const { shape: outer, holes } = shape.extractPoints(divisions);
  const mirror = (points: THREE.Vector2[]) => points.map((point) => new THREE.Vector2(-point.x, point.y)).reverse();
  const result = new THREE.Shape(mirror(outer));
  holes.forEach((hole) => result.holes.push(new THREE.Path(mirror(hole))));
  return result;
});

/** The area shared by `subject` and `clip`, e.g. a pattern clipped to the coaster. */
export const intersectShapes = (subject: THREE.Shape[], clip: THREE.Shape[], divisions = 12): THREE.Shape[] => (
  subject.length && clip.length
    ? execute(ClipperLib.ClipType.ctIntersection, shapesToPaths(subject, divisions), shapesToPaths(clip, divisions))
    : []
);

const ARC_TOLERANCE = 0.02 * SCALE;

const offsetPaths = (paths: Path[], delta: number, endType: ClipperLib.EndType): ClipperLib.PolyTree => {
  const offset = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE);
  offset.AddPaths(paths, ClipperLib.JoinType.jtRound, endType);
  const tree = new ClipperLib.PolyTree();
  offset.Execute(tree, delta * SCALE);
  return tree;
};

/** Grows (positive `delta`) or shrinks (negative) shapes by `delta` mm, with round corners. */
export const offsetShapes = (shapes: THREE.Shape[], delta: number, divisions = 12): THREE.Shape[] => {
  if (!shapes.length) {
    return [];
  }
  // union first: the offset of overlapping outlines would otherwise leave seams
  const merged = shapesToPaths(unionShapes(shapes, divisions), divisions);
  return treeToShapes(offsetPaths(merged, delta, ClipperLib.EndType.etClosedPolygon));
};

export interface Stroke {
  points: THREE.Vector2[];
  /** line width in mm */
  width: number;
  /** erasing strokes remove what was drawn before them */
  erase?: boolean;
}

const strokePaths = (stroke: Stroke): Path[] => {
  const path = stroke.points.map((point) => ({ X: Math.round(point.x * SCALE), Y: Math.round(point.y * SCALE) }));
  if (!path.length || stroke.width <= 0) {
    return [];
  }
  const tree = offsetPaths([path], stroke.width / 2, ClipperLib.EndType.etOpenRound);
  return ClipperLib.Clipper.PolyTreeToPaths(tree);
};

/**
 * Turns freehand strokes into filled shapes: every stroke becomes a line with round caps and joins,
 * drawn strokes are merged and erasing strokes cut away what was drawn before them, in order.
 */
export const strokesToShapes = (strokes: Stroke[]): THREE.Shape[] => {
  let result: Path[] = [];
  strokes.forEach((stroke) => {
    const paths = strokePaths(stroke);
    if (!paths.length || (stroke.erase && !result.length)) {
      return;
    }
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(result, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(paths, ClipperLib.PolyType.ptClip, true);
    const next: Path[] = [];
    clipper.Execute(
      stroke.erase ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctUnion,
      next,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero,
    );
    result = next;
  });
  if (!result.length) {
    return [];
  }
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(result, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return treeToShapes(tree);
};

/** Total area of shapes in mm² (outlines minus holes). */
export const shapesArea = (shapes: THREE.Shape[], divisions = 12): number => shapes.reduce((sum, shape) => {
  const { shape: outer, holes } = shape.extractPoints(divisions);
  return sum + Math.abs(THREE.ShapeUtils.area(outer)) - holes.reduce((holeSum, hole) => holeSum + Math.abs(THREE.ShapeUtils.area(hole)), 0);
}, 0);
