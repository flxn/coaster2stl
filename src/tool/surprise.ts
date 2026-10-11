import {
  COASTER_SHAPES, PATTERNS, QUICK_ICONS, SURPRISE_TEXTS, THEMES,
} from './catalog';
import type { ToolOptions } from './options';
import { LOBE_RANGES } from './outline';

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const chance = (probability: number) => Math.random() < probability;

/**
 * "Surprise me": a random but sensible coaster. Keeps the size, thickness and print settings,
 * replaces shape, artwork, text, pattern and colors, and clears the drawing.
 */
export const surprise = (options: ToolOptions) => {
  const shape = chance(0.45) ? 'circle' : pick(COASTER_SHAPES);
  options.coaster.shape = shape;
  if (shape === 'flower' || shape === 'scallop' || shape === 'gear') {
    const range = LOBE_RANGES[shape];
    options.coaster.lobes = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
  }
  options.rim.enabled = chance(0.7);

  const [iconId, icon] = pick(Object.entries(QUICK_ICONS));
  options.artwork.source = 'icon';
  options.artwork.icon = { id: `quick:${iconId}`, name: icon.name, path: icon.path };
  options.artwork.scale = 38 + Math.round(Math.random() * 16);
  options.artwork.rotation = chance(0.2) ? pick([-15, -8, 8, 15]) : 0;
  options.artwork.offsetX = 0;
  options.artwork.offsetY = 0;
  options.drawing.strokes = [];

  options.text.top = chance(0.85) ? pick(SURPRISE_TEXTS.top) : '';
  options.text.bottom = chance(0.45) ? pick(SURPRISE_TEXTS.bottom) : '';
  options.text.center = '';
  options.text.font = pick(['montserrat', 'oswald', 'righteous', 'bungee', 'playfair', 'lobster'] as const);

  options.pattern.type = chance(0.5) ? 'none' : pick(PATTERNS.filter((pattern) => pattern !== 'none'));
  options.pattern.seed = Math.floor(Math.random() * 1000);
  options.pattern.rotation = pick([0, 0, 15, 30, 45]);

  const theme = THEMES[pick(Object.keys(THEMES) as (keyof typeof THEMES)[])];
  options.colors.base = theme.base;
  options.colors.design = theme.design;
  options.colors.accent = theme.accent;
};
