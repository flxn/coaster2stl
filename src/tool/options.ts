import { isFontFamily, type FontFamilyId } from '@/core/geometry/fonts';
import type { TextAlign } from '@/core/geometry/text';
import {
  COASTER_SHAPES, PATTERNS, QUICK_ICONS, type CoasterShape, type PatternId,
} from './catalog';

export type ReliefMode = 'raised' | 'engraved' | 'inlay';
export type BottomStyle = 'flat' | 'cork' | 'feet';
export type ArtworkSource = 'none' | 'icon' | 'upload';
export type Symmetry = 'none' | 'mirror' | 'radial' | 'kaleidoscope';

/** An icon from the quick picks or the server library (24×24 path data, stored with the design). */
export interface IconChoice {
  /** e.g. 'quick:coffee', 'mdi:coffee-outline' or 'brands:github' */
  id: string;
  name: string;
  path: string;
}

/** An uploaded SVG or traced image, as polygons in a 0…width × 0…height space (Y down). */
export interface UploadedArtwork {
  name: string;
  width: number;
  height: number;
  polygons: { outer: number[]; holes: number[][] }[];
}

/**
 * One freehand stroke on the sketchpad. Coordinates and width are relative to the design radius
 * (the inner radius of the coaster), so drawings scale with the coaster.
 */
export interface DrawingStroke {
  /** flat [x0, y0, x1, y1, …] list, -1…1 with Y up */
  points: number[];
  width: number;
  erase: boolean;
}

/**
 * All settings of the coaster. Plain JSON: reactive in the UI, sent to the worker, saved in the
 * browser, exported as a settings file and published to the gallery.
 * Number fields hold NaN while the user has emptied them.
 */
export interface ToolOptions {
  coaster: {
    shape: CoasterShape;
    /** outer diameter (or width of the square) in mm */
    size: number;
    thickness: number;
    cornerRadius: number;
    /** petals of the flower, bumps of the scallop, teeth of the gear */
    lobes: number;
  };
  rim: {
    enabled: boolean;
    width: number;
    height: number;
  };
  artwork: {
    source: ArtworkSource;
    icon: IconChoice | null;
    upload: UploadedArtwork | null;
    /** size as a percentage of the design area */
    scale: number;
    rotation: number;
    /** offset from the center in mm */
    offsetX: number;
    offsetY: number;
  };
  drawing: {
    strokes: DrawingStroke[];
    symmetry: Symmetry;
    /** copies around the center for radial and kaleidoscope symmetry */
    segments: number;
  };
  text: {
    top: string;
    bottom: string;
    center: string;
    font: FontFamilyId;
    bold: boolean;
    /** cap height of the ring texts in mm */
    size: number;
    centerSize: number;
    letterSpacing: number;
    centerAlign: TextAlign;
  };
  pattern: {
    type: PatternId;
    /** distance between pattern elements in mm */
    spacing: number;
    /** line or dot size in mm */
    weight: number;
    /** free space kept around artwork and text, in mm */
    clearance: number;
    rotation: number;
    seed: number;
  };
  colors: {
    base: string;
    design: string;
    accent: string;
  };
  print: {
    relief: ReliefMode;
    depth: number;
    faceDown: boolean;
  };
  bottom: {
    style: BottomStyle;
    /** width of the solid edge around the cork recess, in mm */
    margin: number;
    depth: number;
    feetDiameter: number;
  };
}

export const MAX_STROKES = 600;
export const MAX_STROKE_POINTS = 60000;

export const defaultOptions: ToolOptions = {
  coaster: {
    shape: 'circle',
    size: 100,
    thickness: 4,
    cornerRadius: 8,
    lobes: 8,
  },
  rim: {
    enabled: true,
    width: 3,
    height: 1.2,
  },
  artwork: {
    source: 'icon',
    icon: { id: 'quick:coffee', name: QUICK_ICONS.coffee.name, path: QUICK_ICONS.coffee.path },
    upload: null,
    scale: 46,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  },
  drawing: {
    strokes: [],
    symmetry: 'radial',
    segments: 8,
  },
  text: {
    top: 'BUT FIRST, COFFEE',
    bottom: '',
    center: '',
    font: 'montserrat',
    bold: true,
    size: 6,
    centerSize: 7,
    letterSpacing: 0.12,
    centerAlign: 'center',
  },
  pattern: {
    type: 'none',
    spacing: 8,
    weight: 1.6,
    clearance: 2.5,
    rotation: 0,
    seed: 7,
  },
  colors: {
    base: '#f4f4f1',
    design: '#4a3226',
    accent: '#c49a6c',
  },
  print: {
    relief: 'raised',
    depth: 1,
    faceDown: false,
  },
  bottom: {
    style: 'flat',
    margin: 5,
    depth: 1.5,
    feetDiameter: 10,
  },
};

/** Whether the coaster has any design element (an empty coaster is a valid, if boring, design). */
export const hasDesign = (options: ToolOptions): boolean => (
  (options.artwork.source === 'icon' && !!options.artwork.icon)
  || (options.artwork.source === 'upload' && !!options.artwork.upload)
  || options.drawing.strokes.length > 0
  || [options.text.top, options.text.bottom, options.text.center].some((text) => text.trim() !== '')
  || options.pattern.type !== 'none'
);

/** Live updates always run: even a plain coaster is a printable model. */
export const isReadyForUpdate = (): boolean => true;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (
  allowed.includes(value as T) ? value as T : fallback
);

const isNumberList = (value: unknown): value is number[] => Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));

const isIconChoice = (value: unknown): value is IconChoice => {
  const icon = value as IconChoice | null;
  return !!icon && typeof icon.id === 'string' && typeof icon.name === 'string'
    && typeof icon.path === 'string' && icon.path.length > 0 && icon.path.length < 20000;
};

export const isUploadedArtwork = (value: unknown): value is UploadedArtwork => {
  const art = value as UploadedArtwork | null;
  return !!art
    && typeof art.name === 'string'
    && typeof art.width === 'number' && art.width > 0
    && typeof art.height === 'number' && art.height > 0
    && Array.isArray(art.polygons)
    && art.polygons.every((polygon) => isNumberList(polygon?.outer) && Array.isArray(polygon.holes) && polygon.holes.every(isNumberList));
};

const cleanStrokes = (value: unknown): DrawingStroke[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  let budget = MAX_STROKE_POINTS * 2;
  return value
    .filter((stroke): stroke is DrawingStroke => !!stroke && isNumberList(stroke.points) && stroke.points.length >= 2
      && typeof stroke.width === 'number' && stroke.width > 0)
    .slice(0, MAX_STROKES)
    .filter((stroke) => {
      budget -= stroke.points.length;
      return budget >= 0;
    })
    .map((stroke) => ({
      points: stroke.points.length % 2 ? stroke.points.slice(0, -1) : stroke.points,
      width: Math.min(0.5, stroke.width),
      erase: stroke.erase === true,
    }));
};

/**
 * Repairs settings from saved state, imported files or the gallery (values that no longer exist,
 * broken lists), so the UI and the generator can rely on the types. Numbers are clamped by the generator.
 */
export const normalizeOptions = (options: ToolOptions): void => {
  const defaults = defaultOptions;
  options.coaster.shape = oneOf(options.coaster.shape, COASTER_SHAPES, defaults.coaster.shape);

  const { artwork } = options;
  artwork.source = oneOf(artwork.source, ['none', 'icon', 'upload'], defaults.artwork.source);
  if (!isIconChoice(artwork.icon)) artwork.icon = null;
  if (!isUploadedArtwork(artwork.upload)) artwork.upload = null;
  if (artwork.source === 'icon' && !artwork.icon) artwork.source = 'none';
  if (artwork.source === 'upload' && !artwork.upload) artwork.source = 'none';

  options.drawing.strokes = cleanStrokes(options.drawing.strokes);
  options.drawing.symmetry = oneOf(options.drawing.symmetry, ['none', 'mirror', 'radial', 'kaleidoscope'], defaults.drawing.symmetry);

  if (!isFontFamily(options.text.font)) options.text.font = defaults.text.font;
  options.text.centerAlign = oneOf(options.text.centerAlign, ['left', 'center', 'right'], defaults.text.centerAlign);
  (['top', 'bottom', 'center'] as const).forEach((key) => {
    options.text[key] = String(options.text[key] ?? '').slice(0, 120);
  });

  options.pattern.type = oneOf(options.pattern.type, PATTERNS, defaults.pattern.type);
  (['base', 'design', 'accent'] as const).forEach((key) => {
    if (!/^#[0-9a-f]{6}$/i.test(options.colors[key])) options.colors[key] = defaults.colors[key];
  });
  options.print.relief = oneOf(options.print.relief, ['raised', 'engraved', 'inlay'], defaults.print.relief);
  options.bottom.style = oneOf(options.bottom.style, ['flat', 'cork', 'feet'], defaults.bottom.style);
};
