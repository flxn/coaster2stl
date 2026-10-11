import * as THREE from 'three';
import type { PathCommand } from 'opentype.js';
import type { FontFamilyId, FontWeight, LoadedFont } from './fonts';
import { ringsToShapes } from './polygons';

export type TextAlign = 'left' | 'center' | 'right';

export interface TextStyle {
  family: FontFamilyId;
  weight: FontWeight;
  /** height of capital letters in mm (what you would measure on the print) */
  size: number;
  /** extra space between letters, as a fraction of the font size */
  letterSpacing?: number;
  uppercase?: boolean;
}

/**
 * Text layout on top of opentype.js: one glyph per character with kerning and letter spacing.
 * Complex scripts that need shaping (ligatures, Arabic, …) are not supported.
 */

const fontSizeFor = (font: LoadedFont, style: TextStyle) => (style.size * font.font.unitsPerEm) / font.capHeight;

const prepare = (text: string, style: TextStyle) => (style.uppercase ? text.toLocaleUpperCase() : text);

interface GlyphPosition {
  char: string;
  x: number;
}

const layoutGlyphs = (font: LoadedFont, text: string, style: TextStyle) => {
  const fontSize = fontSizeFor(font, style);
  const scale = fontSize / font.font.unitsPerEm;
  const spacing = (style.letterSpacing ?? 0) * fontSize;
  const chars = Array.from(prepare(text, style));
  const positions: GlyphPosition[] = [];
  let x = 0;
  let previous = null;
  for (const char of chars) {
    const glyph = font.font.charToGlyph(char);
    if (previous) {
      x += font.font.getKerningValue(previous, glyph) * scale;
    }
    positions.push({ char, x });
    x += glyph.advanceWidth * scale + spacing;
    previous = glyph;
  }
  return { positions, width: Math.max(0, x - (chars.length ? spacing : 0)), fontSize };
};

/** Advance width of a single line in mm. */
export const measureText = (font: LoadedFont, text: string, style: TextStyle): number => layoutGlyphs(font, text, style).width;

/**
 * Vertical extent of a line in mm: from the top of tall letters (ascent) to the bottom of descenders.
 * Lines of the same font and size get the same extent so their baselines line up; only unusually tall
 * or deep characters (e.g. accented capitals) make a line taller.
 */
export const lineExtent = (font: LoadedFont, text: string, style: TextStyle): { ascent: number; descent: number } => {
  let ascent = font.ascent;
  let descent = font.descent;
  Array.from(prepare(text, style)).forEach((char) => {
    if (!char.trim()) return;
    const metrics = font.font.charToGlyph(char).getMetrics();
    if (Number.isFinite(metrics.yMax)) ascent = Math.max(ascent, metrics.yMax);
    if (Number.isFinite(metrics.yMin)) descent = Math.max(descent, -metrics.yMin);
  });
  const scale = style.size / font.capHeight;
  return { ascent: ascent * scale, descent: descent * scale };
};

/**
 * Builds THREE shapes from SVG-like path commands with Y pointing down (as fonts and SVGs use).
 * Curves are flattened into `divisions` segments each; the outlines are then resolved with the fill rule.
 */
export const shapesFromCommands = (
  commands: PathCommand[],
  transform: (x: number, y: number) => [number, number],
  fillRule: 'nonzero' | 'evenodd' = 'nonzero',
  divisions = 8,
) => {
  const path = new THREE.ShapePath();
  commands.forEach((command) => {
    switch (command.type) {
      case 'M':
        path.moveTo(...transform(command.x, command.y));
        break;
      case 'L':
        path.lineTo(...transform(command.x, command.y));
        break;
      case 'Q':
        path.quadraticCurveTo(...transform(command.x1, command.y1), ...transform(command.x, command.y));
        break;
      case 'C':
        path.bezierCurveTo(
          ...transform(command.x1, command.y1),
          ...transform(command.x2, command.y2),
          ...transform(command.x, command.y),
        );
        break;
      case 'Z':
        if (path.currentPath) {
          path.currentPath.autoClose = true;
        }
        break;
      default:
        break;
    }
  });
  // Clipper resolves holes, overlaps and self-intersections by fill rule
  return ringsToShapes(path.subPaths.map((subPath) => subPath.getPoints(divisions)), fillRule);
};

/** Shapes of one line of text, starting at x with the baseline at baselineY (world coordinates, Y up). */
export const textShapes = (font: LoadedFont, text: string, style: TextStyle, x: number, baselineY: number): THREE.Shape[] => {
  const { positions, fontSize } = layoutGlyphs(font, text, style);
  const commands: PathCommand[] = [];
  positions.forEach(({ char, x: glyphX }) => {
    if (char.trim()) {
      commands.push(...font.font.charToGlyph(char).getPath(glyphX, 0, fontSize).commands);
    }
  });
  return shapesFromCommands(commands, (px, py) => [x + px, baselineY - py], 'nonzero', 6);
};
