import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { gridToShapes } from '@/core/geometry/grid';
import type { UploadedArtwork } from './options';

/**
 * Turns uploaded files into artwork polygons (in the browser: SVGLoader and canvases need the DOM).
 * The polygons are normalized to a 1000 unit box with two decimals, so they stay small in saved
 * settings and published designs.
 */

const NORMALIZED_SIZE = 1000;
export const MAX_POINTS = 40000;
/** longest side of an image before tracing; more detail than this does not print anyway */
const TRACE_SIZE = 360;

export class ArtworkError extends Error {}

type Ring = THREE.Vector2[];

/** Rings in any coordinate space (Y down) → normalized artwork. */
const normalize = (rings: { outer: Ring; holes: Ring[] }[], name: string): UploadedArtwork => {
  const box = new THREE.Box2();
  rings.forEach((ring) => ring.outer.forEach((point) => box.expandByPoint(point)));
  if (box.isEmpty()) {
    throw new ArtworkError('empty');
  }
  const size = box.getSize(new THREE.Vector2());
  const scale = NORMALIZED_SIZE / Math.max(size.x, size.y, 1e-6);
  const flat = (points: Ring) => points.flatMap((point) => [
    Math.round((point.x - box.min.x) * scale * 100) / 100,
    Math.round((point.y - box.min.y) * scale * 100) / 100,
  ]);
  const polygons = rings.map((ring) => ({ outer: flat(ring.outer), holes: ring.holes.map(flat) }));
  const points = polygons.reduce((sum, polygon) => sum + polygon.outer.length + polygon.holes.flat().length, 0) / 2;
  if (points > MAX_POINTS) {
    throw new ArtworkError('tooComplex');
  }
  return {
    name,
    width: Math.round(size.x * scale * 100) / 100,
    height: Math.round(size.y * scale * 100) / 100,
    polygons,
  };
};

const isWhite = (fill: string | undefined) => !!fill && /^(#fff(fff)?|white|rgb\(255,\s*255,\s*255\))$/i.test(fill.trim());

/** Filled paths of an SVG become the artwork; strokes without fill and white fills are skipped. */
export const parseSvg = (text: string, name: string): UploadedArtwork => {
  if (!/<svg[\s>]/i.test(text)) {
    throw new ArtworkError('invalid');
  }
  const data = new SVGLoader().parse(text);
  const shapes = data.paths.flatMap((path) => {
    const style = (path.userData as { style?: { fill?: string } } | undefined)?.style;
    if (!style?.fill || style.fill === 'none' || style.fill === 'transparent' || isWhite(style.fill)) {
      return [];
    }
    return path.toShapes();
  });
  if (!shapes.length) {
    throw new ArtworkError('noShapes');
  }
  return normalize(shapes.map((shape) => {
    const { shape: outer, holes } = shape.extractPoints(10);
    return { outer, holes };
  }), name);
};

/* ------------------------------------------------------------------ */
/* Image tracing                                                        */
/* ------------------------------------------------------------------ */

/** Removes points that lie (almost) on the line between their neighbours (Douglas–Peucker). */
const simplify = (points: Ring, tolerance: number): Ring => {
  if (points.length < 4) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start];
    const b = points[end];
    const ab = b.clone().sub(a);
    const length = ab.length() || 1e-9;
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = Math.abs(ab.cross(points[i].clone().sub(a))) / length;
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance && index > 0) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

/** Chaikin corner cutting on a closed ring: turns pixel staircases into smooth curves. */
const smooth = (points: Ring, iterations: number): Ring => {
  let ring = points;
  for (let n = 0; n < iterations; n += 1) {
    const next: Ring = [];
    ring.forEach((point, i) => {
      const following = ring[(i + 1) % ring.length];
      next.push(point.clone().lerp(following, 0.25), point.clone().lerp(following, 0.75));
    });
    ring = next;
  }
  return ring;
};

export interface TraceSettings {
  /** 0…255: pixels darker than this become part of the artwork */
  threshold: number;
  /** use the light parts instead of the dark ones */
  invert: boolean;
}

/** Reads an image file into a canvas of at most TRACE_SIZE pixels (transparent areas count as background). */
export const loadImage = async (file: File): Promise<ImageData> => {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ArtworkError('invalid');
  });
  const scale = Math.min(1, TRACE_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * A threshold that separates the two main brightness groups of the image (Otsu's method),
 * halfway between their mean brightness, so two-tone logos split cleanly.
 */
export const suggestThreshold = (image: ImageData): number => {
  const histogram = new Array<number>(256).fill(0);
  let count = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] < 128) continue;
    histogram[Math.round(0.2126 * image.data[i] + 0.7152 * image.data[i + 1] + 0.0722 * image.data[i + 2])] += 1;
    count += 1;
  }
  if (!count) return 128;
  const total = histogram.reduce((sum, value, index) => sum + value * index, 0);
  let background = 0;
  let sumBackground = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t += 1) {
    background += histogram[t];
    if (!background || background === count) continue;
    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / background;
    const meanForeground = (total - sumBackground) / (count - background);
    const variance = background * (count - background) * (meanBackground - meanForeground) ** 2;
    if (variance > best) {
      best = variance;
      threshold = Math.round((meanBackground + meanForeground) / 2);
    }
  }
  return threshold;
};

/** Traces the dark (or light) areas of an image into smooth artwork polygons. */
export const traceImage = (image: ImageData, { threshold, invert }: TraceSettings, name: string): UploadedArtwork => {
  const { width, height, data } = image;
  const filled = (column: number, row: number) => {
    const i = (row * width + column) * 4;
    if (data[i + 3] < 128) return false;
    const dark = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] < threshold;
    return invert ? !dark : dark;
  };
  // pixel outlines in grid units (Y up, rows going down from 0)
  const shapes = gridToShapes({
    columns: width, rows: height, filled, cell: 1, left: 0, top: 0,
  });
  const minArea = Math.max(4, (width * height) / 6000);
  const prepare = (points: Ring) => simplify(smooth(points.map((point) => new THREE.Vector2(point.x, -point.y)), 2), 0.18);
  const rings = shapes
    .map((shape) => {
      const { shape: outer, holes } = shape.extractPoints(1);
      return { outer, holes };
    })
    .filter((ring) => Math.abs(THREE.ShapeUtils.area(ring.outer)) >= minArea)
    .map((ring) => ({
      outer: prepare(ring.outer),
      holes: ring.holes.filter((hole) => Math.abs(THREE.ShapeUtils.area(hole)) >= minArea).map(prepare),
    }));
  if (!rings.length) {
    throw new ArtworkError('noShapes');
  }
  return normalize(rings, name);
};
