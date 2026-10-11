import { toNumber } from '@/core/utils/options';
import { QUICK_ICONS, THEMES } from './catalog';
import type { ToolOptions } from './options';
import { SURPRISE_COLLECTIONS } from './surprise-presets';

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const chance = (probability: number) => Math.random() < probability;

/**
 * Keeps size, thickness and print settings. Each roll combines a related icon and caption
 * with a compatible shape, typeface and palette, then resets the design's layout settings.
 */
export const surprise = (options: ToolOptions) => {
  const currentIcon = options.artwork.icon?.id;
  const collection = pick(SURPRISE_COLLECTIONS.filter((item) => !item.motifs
    .some((motif) => currentIcon === `quick:${motif.icon}`)));
  const motif = pick(collection.motifs);
  const labels = motif.puns && chance(0.35) ? motif.puns : motif.labels;
  const alternatives = labels.filter((label) => label !== options.text.top);
  const caption = chance(0.8) ? pick(alternatives.length ? alternatives : labels) : '';
  const size = toNumber(options.coaster.size, 100, 40, 250);
  const scale = size / 100;
  const faceDown = options.print.relief !== 'raised' && options.print.faceDown;

  const shape = pick(collection.shapes);
  options.coaster.shape = shape;
  options.coaster.cornerRadius = Math.min(10, size * 0.08);
  if (shape === 'flower' || shape === 'scallop' || shape === 'gear') {
    options.coaster.lobes = pick({ flower: [6, 8, 10], scallop: [16, 20, 24], gear: [12, 16, 20] }[shape]);
  }
  options.rim.enabled = !faceDown && chance(0.65);
  options.rim.width = Math.max(1.2, Math.min(4, 3 * scale));
  options.rim.height = options.print.relief === 'raised'
    ? Math.max(1.2, toNumber(options.print.depth, 1, 0.2, 5)) : 1.2;

  const icon = QUICK_ICONS[motif.icon];
  options.artwork.source = 'icon';
  options.artwork.icon = { id: `quick:${motif.icon}`, name: icon.name, path: icon.path };
  options.artwork.upload = null;
  options.artwork.scale = caption ? pick([40, 44, 48]) : pick([56, 60, 64]);
  options.artwork.rotation = 0;
  options.artwork.offsetX = 0;
  options.artwork.offsetY = 0;
  options.drawing.strokes = [];

  options.text.top = caption;
  options.text.bottom = '';
  options.text.center = '';
  options.text.font = caption.length > 16 ? 'oswald' : pick(collection.fonts);
  options.text.bold = true;
  options.text.size = Math.max(2.8, Math.min(8, 5.5 * scale));
  options.text.centerSize = options.text.size;
  options.text.letterSpacing = 0.06;
  options.text.centerAlign = 'center';

  options.pattern.type = chance(caption ? 0.7 : 0.4) ? 'none' : pick(collection.patterns);
  options.pattern.spacing = Math.max(4, 10 * scale);
  options.pattern.weight = Math.max(0.8, Math.min(2, 1.2 * scale));
  options.pattern.clearance = Math.max(1.5, 3 * scale);
  options.pattern.seed = Math.floor(Math.random() * 1000);
  options.pattern.rotation = 0;

  const theme = THEMES[pick(collection.themes)];
  options.colors.base = theme.base;
  options.colors.design = theme.design;
  options.colors.accent = theme.accent;
};
