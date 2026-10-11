import type { FontFamilyId } from '@/core/geometry/fonts';
import type { CoasterShape, PatternId, QUICK_ICONS, ThemeId } from './catalog';

interface Motif {
  icon: keyof typeof QUICK_ICONS;
  labels: readonly string[];
  /** Occasional coffee/beer and 3D-printing wordplay, always paired with the right artwork. */
  puns?: readonly string[];
}

interface Collection {
  motifs: readonly Motif[];
  shapes: readonly CoasterShape[];
  fonts: readonly FontFamilyId[];
  themes: readonly ThemeId[];
  patterns: readonly PatternId[];
}

/** Choose a subject first; its lettering, colors and geometry should belong together. */
export const SURPRISE_COLLECTIONS: readonly Collection[] = [
  {
    motifs: [
      {
        icon: 'coffee', labels: ['COFFEE', 'ESPRESSO', 'COFFEE BREAK', 'MORNING BREW'],
        puns: ['LAYER BY LATTE', 'FIRST LAYER FUEL', 'COFFEE & CALIBRATION', 'BREWED IN LAYERS'],
      },
      { icon: 'tea', labels: ['TEA TIME', 'AFTERNOON TEA', 'TEA BREAK'] },
      { icon: 'croissant', labels: ['BRUNCH', 'SUNDAY MORNING'] },
      { icon: 'cookie', labels: ['COOKIES', 'COFFEE & COOKIES'] },
    ],
    shapes: ['circle', 'circle', 'scallop', 'octagon'],
    fonts: ['montserrat', 'oswald', 'playfair'],
    themes: ['espresso', 'workshop', 'classic'],
    patterns: ['rings', 'dots'],
  },
  {
    motifs: [
      {
        icon: 'beer', labels: ['ON TAP', 'LAGER', 'BEER GARDEN', 'AFTER HOURS'],
        puns: ['PRINTS & PINTS', 'LAYER AFTER LAGER', 'HOT BED, COLD BEER', 'FILAMENT & FOAM'],
      },
      {
        icon: 'beerBottle', labels: ['CRAFT BEER', 'PALE ALE', 'COLD BEER'],
        puns: ['PRINTS & PINTS', 'LAYER AFTER LAGER', 'HOT BED, COLD BEER'],
      },
    ],
    shapes: ['circle', 'circle', 'hexagon', 'octagon'],
    fonts: ['oswald', 'righteous', 'bungee'],
    themes: ['espresso', 'workshop', 'classic'],
    patterns: ['rings', 'sunburst'],
  },
  {
    motifs: [
      { icon: 'wine', labels: ['WINE BAR', 'HOUSE WINE'] },
      { icon: 'cocktail', labels: ['APERITIVO', 'COCKTAIL HOUR'] },
      { icon: 'citrus', labels: ['CITRUS', 'ON THE ROCKS'] },
      { icon: 'champagne', labels: ['CHEERS', 'BUBBLES'] },
    ],
    shapes: ['circle', 'scallop', 'octagon'],
    fonts: ['playfair', 'montserrat', 'righteous'],
    themes: ['midnight', 'beachBar', 'mojito'],
    patterns: ['dots', 'rings'],
  },
  {
    motifs: [
      { icon: 'leaf', labels: ['BOTANICAL', 'LEAVES'] },
      { icon: 'flower', labels: ['IN BLOOM', 'WILDFLOWERS'] },
      { icon: 'mushroom', labels: ['WOODLAND', 'MUSHROOMS'] },
      { icon: 'bee', labels: ['HONEY BEE', 'POLLEN CLUB'] },
      { icon: 'cactus', labels: ['CACTUS', 'DESERT GARDEN'] },
    ],
    shapes: ['circle', 'flower', 'scallop'],
    fonts: ['montserrat', 'playfair'],
    themes: ['mojito', 'workshop', 'espresso'],
    patterns: ['dots', 'rings'],
  },
  {
    motifs: [
      { icon: 'wave', labels: ['TIDELINE', 'SEA GLASS'] },
      { icon: 'sailboat', labels: ['SAILING CLUB', 'OFFSHORE'] },
      { icon: 'palm', labels: ['PALM BEACH', 'SUMMER HOUSE'] },
      { icon: 'beach', labels: ['BEACH BAR', 'BY THE SEA'] },
    ],
    shapes: ['circle', 'scallop', 'square'],
    fonts: ['righteous', 'montserrat'],
    themes: ['beachBar', 'mojito', 'midnight'],
    patterns: ['waves', 'sunburst'],
  },
  {
    motifs: [
      { icon: 'mountains', labels: ['ALPINE', 'BASE CAMP'] },
      { icon: 'tent', labels: ['CAMP COFFEE', 'CAMPSITE'] },
      { icon: 'pine', labels: ['PINE FOREST', 'CABIN'] },
      { icon: 'compass', labels: ['NORTH', 'TRAILHEAD'] },
    ],
    shapes: ['circle', 'hexagon', 'octagon'],
    fonts: ['oswald', 'montserrat'],
    themes: ['workshop', 'espresso', 'mojito'],
    patterns: ['rings', 'dots'],
  },
  {
    motifs: [
      { icon: 'moon', labels: ['MOONLIGHT', 'NIGHT SHIFT'] },
      { icon: 'orbit', labels: ['ORBIT', 'LOW EARTH ORBIT'] },
      { icon: 'rocket', labels: ['LIFT OFF', 'SPACE CLUB'] },
      { icon: 'sun', labels: ['DAYLIGHT', 'GOLDEN HOUR'] },
    ],
    shapes: ['circle', 'hexagon', 'octagon'],
    fonts: ['righteous', 'oswald', 'montserrat'],
    themes: ['midnight', 'classic', 'citrus'],
    patterns: ['rings', 'sunburst'],
  },
  {
    motifs: [
      { icon: 'gamepad', labels: ['PLAYER ONE', 'GAME NIGHT'] },
      { icon: 'dice', labels: ['GAME NIGHT', 'YOUR TURN'] },
      { icon: 'headphones', labels: ['LISTENING ROOM', 'SIDE A'] },
      { icon: 'nozzle', labels: ['MAKER SPACE', 'LAYER ONE'] },
    ],
    shapes: ['circle', 'square', 'hexagon', 'gear'],
    fonts: ['righteous', 'oswald', 'bungee'],
    themes: ['classic', 'midnight', 'workshop'],
    patterns: ['checker', 'rings'],
  },
];
