import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { isFontFamily, loadFont, type LoadedFont } from '@/core/geometry/fonts';
import {
  intersectShapes, mirrorShapesX, offsetShapes, shapesArea, strokesToShapes, subtractShapes, unionShapes,
} from '@/core/geometry/polygons';
import { circleShape, extrudeShape } from '@/core/geometry/shapes';
import { shapesFromPathData, shapesFromPolygons, type Rect } from '@/core/geometry/svg';
import {
  lineExtent, measureText, textShapes, type TextStyle,
} from '@/core/geometry/text';
import { arcMapping, warpShapes, type ArcSide } from '@/core/geometry/warp';
import type { GenerateContext, Generator, ModelPart } from '@/core/types';
import { round1, toNumber } from '@/core/utils/options';
import { COASTER_SHAPES, PATTERNS } from './catalog';
import { expandStrokes } from './drawing';
import { isUploadedArtwork, type ToolOptions } from './options';
import { coasterOutline, inscribedRadius } from './outline';
import { patternShapes } from './patterns';

/** material that has to remain between the bottom features and the top relief */
const MIN_FLOOR = 0.8;
/** gap between the ring texts and the edge of the design area */
const EDGE_GAP = 1.6;
/** the ring texts may cover at most this angle, so top and bottom text never meet */
const MAX_ARC = THREE.MathUtils.degToRad(150);
const MAX_ARC_ALONE = THREE.MathUtils.degToRad(320);
/** details narrower than this are hard to print with a 0.4 mm nozzle */
const MIN_TEXT_SIZE = 2.5;

const colorValue = (hex: string, fallback: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : fallback);

/** Rotates shapes around (cx, cy). */
const rotateAround = (shapes: THREE.Shape[], degrees: number, cx: number, cy: number) => {
  if (!degrees) {
    return shapes;
  }
  const angle = THREE.MathUtils.degToRad(-degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return warpShapes(shapes, (x, y) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos], Infinity);
};

interface RingTextResult {
  shapes: THREE.Shape[];
  scaled: boolean;
  size: number;
}

/**
 * Text along the inside of the rim: laid out on a straight baseline, then bent onto the circle.
 * Text that would not fit the available arc is made smaller.
 */
const ringText = (
  font: LoadedFont,
  value: string,
  style: TextStyle,
  side: ArcSide,
  outerRadius: number,
  maxArc: number,
): RingTextResult => {
  const text = value.trim();
  if (!text) {
    return { shapes: [], scaled: false, size: style.size };
  }
  // the baseline radius depends on the size, so shrink until the text fits its arc
  let size = style.size;
  let scaled = false;
  let shapes: THREE.Shape[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = { ...style, size };
    const { ascent, descent } = lineExtent(font, text, current);
    // top: letters point outwards, bottom: inwards; descenders must stay inside the design area too
    const baseline = side === 'top' ? outerRadius - ascent : outerRadius - descent;
    const width = measureText(font, text, current);
    const arc = width / Math.max(baseline - (side === 'top' ? 0 : ascent / 2), 1);
    if (arc > maxArc && attempt < 5) {
      size *= (maxArc / arc) * 0.98;
      scaled = true;
      continue;
    }
    shapes = warpShapes(textShapes(font, text, current, -width / 2, 0), arcMapping(baseline, side));
    break;
  }
  return { shapes, scaled, size };
};

/**
 * Coaster: a plate in one of several shapes with an optional rim, artwork (icon, brand logo or upload),
 * a freehand drawing, curved and centered text and a background pattern. Details are raised, engraved
 * or inlaid flush; the underside can hold a cork pad or rubber feet.
 * Runs in the model worker (see src/core/worker/model.worker.ts).
 */
const generateModel: Generator<ToolOptions> = async (options, { warn }: GenerateContext) => {
  /* ---------- settings ---------- */
  const shape = COASTER_SHAPES.includes(options.coaster.shape) ? options.coaster.shape : 'circle';
  const size = toNumber(options.coaster.size, 100, 40, 250);
  const thickness = toNumber(options.coaster.thickness, 4, 1.6, 15);
  const relief = ['raised', 'engraved', 'inlay'].includes(options.print.relief) ? options.print.relief : 'raised';
  const faceDown = relief !== 'raised' && options.print.faceDown;
  const rimEnabled = options.rim.enabled && !faceDown;
  const rimWidth = rimEnabled ? toNumber(options.rim.width, 3, 0.8, size / 6) : 0;
  const rimHeight = toNumber(options.rim.height, 1.2, 0.2, 10);
  if (options.rim.enabled && faceDown) {
    warn('rimFaceDown');
  }

  const bottomStyle = ['flat', 'cork', 'feet'].includes(options.bottom.style) ? options.bottom.style : 'flat';
  const depth = toNumber(options.print.depth, 1, 0.2, 5);
  let bottomDepth = bottomStyle === 'flat' ? 0 : toNumber(options.bottom.depth, 1.5, 0.4, 6);
  let surfaceDepth = relief === 'raised' ? 0 : depth;
  if (bottomDepth + surfaceDepth > thickness - MIN_FLOOR) {
    const available = Math.max(0, thickness - MIN_FLOOR);
    if (surfaceDepth > available) {
      surfaceDepth = Math.max(0.2, available);
      bottomDepth = 0;
    } else {
      bottomDepth = Math.max(0, available - surfaceDepth);
    }
    warn('depthLimited', { value: round1(thickness) });
  }

  const colors = {
    base: colorValue(options.colors.base, 0xf4f4f1),
    design: colorValue(options.colors.design, 0x4a3226),
    accent: colorValue(options.colors.accent, 0xc49a6c),
  };

  /* ---------- outline and design area ---------- */
  const outline = coasterOutline(shape, size, toNumber(options.coaster.cornerRadius, 8, 0), toNumber(options.coaster.lobes, 8, 3, 40));
  const designArea = rimWidth > 0 ? offsetShapes(outline, -rimWidth) : outline;
  // a small gap keeps the design off the inner wall of the rim
  const designClip = offsetShapes(designArea, rimWidth > 0 ? -0.6 : -1.2);
  const designRadius = inscribedRadius(designClip);

  /* ---------- design elements ---------- */
  const design: THREE.Shape[] = [];
  const clipped = (shapes: THREE.Shape[]) => {
    if (!shapes.length) return shapes;
    const inside = intersectShapes(shapes, designClip);
    if (shapesArea(inside) < shapesArea(unionShapes(shapes)) * 0.985) {
      warn('artworkClipped');
    }
    return inside;
  };

  // artwork
  const { artwork } = options;
  const artworkSize = (toNumber(artwork.scale, 46, 5, 100) / 100) * designRadius * 2;
  const artX = toNumber(artwork.offsetX, 0, -size, size);
  const artY = toNumber(artwork.offsetY, 0, -size, size);
  const artRect: Rect = {
    x: artX - artworkSize / 2, y: artY - artworkSize / 2, width: artworkSize, height: artworkSize,
  };
  let artShapes: THREE.Shape[] = [];
  let artBottom = Infinity;
  if (artwork.source === 'icon' && artwork.icon?.path) {
    try {
      artShapes = shapesFromPathData(artwork.icon.path, artRect);
    } catch {
      warn('artworkInvalid');
    }
  } else if (artwork.source === 'upload' && isUploadedArtwork(artwork.upload)) {
    artShapes = shapesFromPolygons(artwork.upload.polygons, artwork.upload, artRect);
  }
  if (artShapes.length) {
    artShapes = rotateAround(artShapes, toNumber(artwork.rotation, 0, -360, 360), artX, artY);
    const box = new THREE.Box2();
    artShapes.forEach((item) => item.extractPoints(6).shape.forEach((point) => box.expandByPoint(point)));
    artBottom = box.min.y;
    design.push(...clipped(artShapes));
  }

  // freehand drawing (relative to the design radius)
  const { drawing } = options;
  if (Array.isArray(drawing.strokes) && drawing.strokes.length) {
    const strokes = expandStrokes(drawing.strokes, drawing.symmetry, toNumber(drawing.segments, 8, 2, 24)).map((stroke) => {
      const points: THREE.Vector2[] = [];
      for (let i = 0; i + 1 < stroke.points.length; i += 2) {
        points.push(new THREE.Vector2(stroke.points[i] * designRadius, stroke.points[i + 1] * designRadius));
      }
      return { points, width: Math.max(0.4, stroke.width * designRadius), erase: stroke.erase };
    });
    design.push(...clipped(strokesToShapes(strokes)));
  }

  // text
  const { text } = options;
  const family = isFontFamily(text.font) ? text.font : 'montserrat';
  const weight = text.bold ? 'bold' : 'regular';
  const hasText = [text.top, text.bottom, text.center].some((value) => String(value ?? '').trim());
  if (hasText) {
    const font = await loadFont(family, weight);
    const letterSpacing = toNumber(text.letterSpacing, 0.1, -0.1, 1);
    const ringSize = toNumber(text.size, 6, 1, 30);
    const textRadius = designRadius - EDGE_GAP;
    const both = !!String(text.top ?? '').trim() && !!String(text.bottom ?? '').trim();
    const maxArc = both ? MAX_ARC : MAX_ARC_ALONE;
    let smallest = Infinity;
    let ringScaled = false;
    let innerLimit = designRadius;
    (['top', 'bottom'] as const).forEach((side) => {
      const result = ringText(font, String(text[side] ?? ''), {
        family, weight, size: ringSize, letterSpacing,
      }, side, textRadius, maxArc);
      if (result.shapes.length) {
        design.push(...result.shapes);
        smallest = Math.min(smallest, result.size);
        ringScaled = ringScaled || result.scaled;
        innerLimit = Math.min(innerLimit, textRadius - result.size * 1.45);
      }
    });
    if (ringScaled) {
      warn('ringTextScaled');
    }

    // center text: below the artwork, or in the middle without artwork
    const lines = String(text.center ?? '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 4);
    if (lines.length) {
      let centerSize = toNumber(text.centerSize, 7, 1, 40);
      const style = (sizeValue: number): TextStyle => ({
        family, weight, size: sizeValue, letterSpacing: letterSpacing * 0.5,
      });
      const lineHeight = (sizeValue: number) => sizeValue * 1.45;
      const blockHeight = (sizeValue: number) => lineHeight(sizeValue) * (lines.length - 1) + sizeValue;
      const top = () => (Number.isFinite(artBottom) ? artBottom - centerSize * 0.6 : blockHeight(centerSize) / 2);
      // the widest line has to fit the chord of the inner circle at its height
      const fits = () => lines.every((line, index) => {
        const y = top() - index * lineHeight(centerSize);
        const halfChord = Math.sqrt(Math.max(0, innerLimit ** 2 - Math.max(y ** 2, (y - centerSize) ** 2)));
        return measureText(font, line, style(centerSize)) <= halfChord * 2 * 0.94;
      }) && top() - blockHeight(centerSize) > -innerLimit;
      let shrunk = false;
      for (let i = 0; i < 12 && !fits() && centerSize > 1.5; i += 1) {
        centerSize *= 0.88;
        shrunk = true;
      }
      if (shrunk) {
        warn('centerTextScaled');
      }
      smallest = Math.min(smallest, centerSize);
      lines.forEach((line, index) => {
        const width = measureText(font, line, style(centerSize));
        const baseline = top() - centerSize - index * lineHeight(centerSize);
        const align = text.centerAlign;
        const x = align === 'left' ? -innerLimit * 0.7 : align === 'right' ? innerLimit * 0.7 - width : -width / 2;
        design.push(...textShapes(font, line, style(centerSize), x, baseline));
      });
    }
    if (smallest < MIN_TEXT_SIZE) {
      warn('textSmall', { size: round1(smallest) });
    }
  }

  const designShapes = design.length ? unionShapes(design) : [];

  /* ---------- pattern ---------- */
  const patternType = PATTERNS.includes(options.pattern.type) ? options.pattern.type : 'none';
  let patternParts: THREE.Shape[] = [];
  if (patternType !== 'none') {
    const raw = patternShapes(patternType, {
      radius: size / 2,
      spacing: toNumber(options.pattern.spacing, 8, 2, 40),
      weight: toNumber(options.pattern.weight, 1.6, 0.4, 20),
      rotation: toNumber(options.pattern.rotation, 0, -360, 360),
      seed: toNumber(options.pattern.seed, 7, 0, 1e9),
    });
    const clearance = toNumber(options.pattern.clearance, 2.5, 0, 20);
    const keepOut = designShapes.length ? offsetShapes(designShapes, Math.max(0.01, clearance)) : [];
    patternParts = subtractShapes(intersectShapes(raw, designClip), keepOut);
  }

  /* ---------- bottom features ---------- */
  let pockets: THREE.Shape[] = [];
  if (bottomDepth > 0 && bottomStyle === 'cork') {
    pockets = offsetShapes(outline, -toNumber(options.bottom.margin, 5, 1.5, size / 4));
    if (!faceDown) {
      warn('corkBridging');
    }
  } else if (bottomDepth > 0 && bottomStyle === 'feet') {
    const feet = toNumber(options.bottom.feetDiameter, 10, 3, 30);
    const distance = inscribedRadius(outline) - feet / 2 - 3;
    pockets = [0, 1, 2, 3].map((i) => {
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      return circleShape(feet / 2, Math.cos(angle) * distance, Math.sin(angle) * distance);
    });
  }

  /* ---------- parts ---------- */
  const mirror = (shapes: THREE.Shape[]) => (faceDown ? mirrorShapesX(shapes) : shapes);
  const designPrint = mirror(designShapes);
  const patternPrint = mirror(patternParts);
  const pocketPrint = mirror(pockets);
  const layers: THREE.BufferGeometry[] = [];
  const parts: ModelPart[] = [];

  // z ranges of the layers, from the print bed up
  const surfaceZ = faceDown ? 0 : thickness - surfaceDepth;
  const bottomZ = faceDown ? thickness - bottomDepth : 0;
  const coreStart = faceDown ? surfaceDepth : bottomDepth;
  const coreHeight = thickness - surfaceDepth - bottomDepth;

  layers.push(extrudeShape(outline, coreHeight, coreStart));
  if (bottomDepth > 0) {
    layers.push(extrudeShape(pockets.length ? subtractShapes(outline, pocketPrint) : outline, bottomDepth, bottomZ));
  }

  const details = [
    { name: 'design', shapes: designPrint, color: colors.design, segments: 6 },
    { name: 'pattern', shapes: patternPrint, color: colors.accent, segments: 8 },
  ].filter((detail) => detail.shapes.length);

  if (relief === 'raised') {
    details.forEach((detail) => parts.push({
      name: detail.name, role: 'detail', color: detail.color, geometry: extrudeShape(detail.shapes, depth, thickness, detail.segments),
    }));
  } else {
    // engraving and inlays are cut in 2D: the surface layer gets the details as holes,
    // and the inlay parts use exactly the same outlines, so they fill the holes without gaps
    layers.push(extrudeShape(subtractShapes(outline, details.flatMap((detail) => detail.shapes)), surfaceDepth, surfaceZ, 1));
    if (relief === 'inlay') {
      details.forEach((detail) => parts.push({
        name: detail.name, role: 'detail', color: detail.color, geometry: extrudeShape(detail.shapes, surfaceDepth, surfaceZ, 1),
      }));
    }
  }

  if (rimWidth > 0) {
    layers.push(extrudeShape(subtractShapes(outline, designArea), rimHeight, thickness));
    if (relief === 'raised' && depth > rimHeight + 0.01 && details.length) {
      warn('rimLow');
    }
  }
  if (faceDown) {
    warn('faceDown');
  }

  return [{ name: 'base', role: 'base', color: colors.base, geometry: mergeGeometries(layers) }, ...parts];
};

export default generateModel;
