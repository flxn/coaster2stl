import * as THREE from 'three';

/** Segments per curve when shapes are extruded; high enough for smooth corners and circles. */
const CURVE_SEGMENTS = 24;

const traceRoundedRect = (path: THREE.Path, width: number, height: number, radius: number, cx: number, cy: number): void => {
  const w = width / 2;
  const h = height / 2;
  const r = Math.max(0, Math.min(radius, w, h));
  if (r <= 0) {
    path.moveTo(cx - w, cy - h);
    path.lineTo(cx + w, cy - h);
    path.lineTo(cx + w, cy + h);
    path.lineTo(cx - w, cy + h);
    path.lineTo(cx - w, cy - h);
    return;
  }
  path.moveTo(cx - w + r, cy - h);
  path.lineTo(cx + w - r, cy - h);
  path.absarc(cx + w - r, cy - h + r, r, -Math.PI / 2, 0, false);
  path.lineTo(cx + w, cy + h - r);
  path.absarc(cx + w - r, cy + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(cx - w + r, cy + h);
  path.absarc(cx - w + r, cy + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(cx - w, cy - h + r);
  path.absarc(cx - w + r, cy - h + r, r, Math.PI, Math.PI * 1.5, false);
};

/** Rectangle centered at (cx, cy); the radius is limited to half the shorter side. */
export const roundedRectShape = (width: number, height: number, radius = 0, cx = 0, cy = 0): THREE.Shape => {
  const shape = new THREE.Shape();
  traceRoundedRect(shape, width, height, radius, cx, cy);
  return shape;
};

/** Same outline as `roundedRectShape`, as a path for `shape.holes`. */
export const roundedRectPath = (width: number, height: number, radius = 0, cx = 0, cy = 0): THREE.Path => {
  const path = new THREE.Path();
  traceRoundedRect(path, width, height, radius, cx, cy);
  return path;
};

export const circleShape = (radius: number, x = 0, y = 0): THREE.Shape => {
  const shape = new THREE.Shape();
  shape.absarc(x, y, radius, 0, Math.PI * 2, false);
  return shape;
};

export const circlePath = (radius: number, x = 0, y = 0): THREE.Path => {
  const path = new THREE.Path();
  path.absarc(x, y, radius, 0, Math.PI * 2, false);
  return path;
};

/**
 * A ring: the outline of `outer` with `inner` cut out, e.g. a border along the plate edge.
 * Both shapes are expected to be centered at the origin.
 */
export const ringShape = (outer: THREE.Shape, inner: THREE.Path): THREE.Shape => {
  const shape = outer.clone();
  shape.holes.push(inner);
  return shape;
};

/** Extrudes a 2D shape upwards from `z` by `depth` millimeters. Small text needs fewer curve segments. */
export const extrudeShape = (
  shape: THREE.Shape | THREE.Shape[],
  depth: number,
  z = 0,
  curveSegments = CURVE_SEGMENTS,
): THREE.BufferGeometry => {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments,
  });
  if (z) {
    geometry.translate(0, 0, z);
  }
  return geometry;
};

/** Vertical cylinder standing on `z`, e.g. a hole or pocket to subtract with `csg.subtract`. */
export const cylinder = (radius: number, height: number, x = 0, y = 0, z = 0, segments = 48): THREE.BufferGeometry => {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(x, y, z + height / 2);
  return geometry;
};
