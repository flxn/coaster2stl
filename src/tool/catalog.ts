/**
 * Static data shared by the panel (UI) and the generator (worker):
 * coaster shapes, patterns, filament colors, color themes and the quick-pick icons.
 */
import {
  mdiAnchor, mdiBee, mdiBeer, mdiBicycle, mdiBottleWine, mdiButterfly, mdiCactus, mdiCake, mdiCamera, mdiCat,
  mdiChessKnight, mdiCloud, mdiCoffee, mdiCompass, mdiCookie, mdiCrown, mdiCube, mdiCupWater, mdiDiamondStone,
  mdiDice5, mdiDog, mdiDuck, mdiEarth, mdiEmoticonCool, mdiEmoticonHappy, mdiFire, mdiFish, mdiFlower,
  mdiFlowerTulip, mdiFoodCroissant, mdiFruitCherries, mdiFruitCitrus, mdiFruitPineapple, mdiFruitWatermelon,
  mdiGamepadVariant, mdiGhost, mdiGlassCocktail, mdiGlassFlute, mdiGlassMugVariant, mdiGlassWine,
  mdiGuitarAcoustic, mdiHeadphones, mdiHeart, mdiHexagonMultiple, mdiHome, mdiIceCream, mdiImageFilterHdr,
  mdiInfinity, mdiJellyfish, mdiKettle, mdiLeaf, mdiLeafMaple, mdiLightbulbOn, mdiMoonWaningCrescent, mdiMushroom,
  mdiMusic, mdiOrbit, mdiOwl, mdiPalmTree, mdiPalette, mdiPartyPopper, mdiPaw, mdiPeace, mdiPineTree, mdiPizza,
  mdiPrinter3dNozzle, mdiPumpkin, mdiPuzzle, mdiRobot, mdiRocketLaunch, mdiSailBoat, mdiSkull, mdiSnowflake,
  mdiSprout, mdiStar, mdiStarFourPoints, mdiTea, mdiTent, mdiTurtle, mdiUmbrellaBeach, mdiWave,
  mdiWeatherLightning, mdiWhiteBalanceSunny, mdiYinYang,
} from '@mdi/js';

/* ------------------------------------------------------------------ */
/* Coaster shapes                                                      */
/* ------------------------------------------------------------------ */

export const COASTER_SHAPES = ['circle', 'square', 'hexagon', 'octagon', 'flower', 'scallop', 'gear'] as const;
export type CoasterShape = (typeof COASTER_SHAPES)[number];

/** shapes with straight corners that can be rounded */
export const CORNERED_SHAPES: CoasterShape[] = ['square', 'hexagon', 'octagon'];
/** shapes with a configurable number of lobes / teeth */
export const LOBED_SHAPES: CoasterShape[] = ['flower', 'scallop', 'gear'];

/* ------------------------------------------------------------------ */
/* Patterns                                                            */
/* ------------------------------------------------------------------ */

export const PATTERNS = ['none', 'rings', 'dots', 'honeycomb', 'waves', 'sunburst', 'checker', 'terrazzo'] as const;
export type PatternId = (typeof PATTERNS)[number];

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

/** Common filament colors, so the preview looks like the print. */
export const FILAMENT_COLORS = [
  { id: 'white', hex: '#f4f4f1' },
  { id: 'ivory', hex: '#efe6d2' },
  { id: 'cork', hex: '#c49a6c' },
  { id: 'wood', hex: '#a07a52' },
  { id: 'espresso', hex: '#4a3226' },
  { id: 'black', hex: '#1b1c1e' },
  { id: 'grey', hex: '#62666d' },
  { id: 'silver', hex: '#a9adb3' },
  { id: 'gold', hex: '#c9a447' },
  { id: 'copper', hex: '#b8734a' },
  { id: 'red', hex: '#c8312f' },
  { id: 'coral', hex: '#ec6a4c' },
  { id: 'orange', hex: '#e7782c' },
  { id: 'yellow', hex: '#f1c232' },
  { id: 'lime', hex: '#9bc53d' },
  { id: 'green', hex: '#2f8f5b' },
  { id: 'teal', hex: '#1f8a8a' },
  { id: 'sky', hex: '#5aa9e6' },
  { id: 'blue', hex: '#2f5fb3' },
  { id: 'navy', hex: '#1f2a4d' },
  { id: 'purple', hex: '#6b46a8' },
  { id: 'pink', hex: '#e07aa6' },
] as const;

/** One-click color combinations: base, design (artwork and text) and accent (pattern). */
export const THEMES = {
  espresso: { base: '#4a3226', design: '#efe6d2', accent: '#b8734a' },
  mojito: { base: '#f4f4f1', design: '#2f8f5b', accent: '#9bc53d' },
  beachBar: { base: '#efe6d2', design: '#1f8a8a', accent: '#ec6a4c' },
  midnight: { base: '#1f2a4d', design: '#c9a447', accent: '#a9adb3' },
  classic: { base: '#f4f4f1', design: '#1b1c1e', accent: '#62666d' },
  bubblegum: { base: '#e07aa6', design: '#f4f4f1', accent: '#6b46a8' },
  workshop: { base: '#a07a52', design: '#1b1c1e', accent: '#efe6d2' },
  citrus: { base: '#f1c232', design: '#1b1c1e', accent: '#e7782c' },
} as const;

export type ThemeId = keyof typeof THEMES;

/* ------------------------------------------------------------------ */
/* Quick-pick icons (Material Design Icons, Apache 2.0)                */
/* The full icon and brand library is searched through the server API. */
/* ------------------------------------------------------------------ */

export const QUICK_ICONS = {
  coffee: { name: 'Coffee', path: mdiCoffee },
  tea: { name: 'Tea', path: mdiTea },
  kettle: { name: 'Kettle', path: mdiKettle },
  water: { name: 'Water', path: mdiCupWater },
  beer: { name: 'Beer', path: mdiGlassMugVariant },
  beerBottle: { name: 'Beer bottle', path: mdiBeer },
  wine: { name: 'Wine', path: mdiGlassWine },
  wineBottle: { name: 'Wine bottle', path: mdiBottleWine },
  cocktail: { name: 'Cocktail', path: mdiGlassCocktail },
  champagne: { name: 'Champagne', path: mdiGlassFlute },
  croissant: { name: 'Croissant', path: mdiFoodCroissant },
  cookie: { name: 'Cookie', path: mdiCookie },
  cake: { name: 'Cake', path: mdiCake },
  iceCream: { name: 'Ice cream', path: mdiIceCream },
  pizza: { name: 'Pizza', path: mdiPizza },
  citrus: { name: 'Citrus', path: mdiFruitCitrus },
  cherries: { name: 'Cherries', path: mdiFruitCherries },
  pineapple: { name: 'Pineapple', path: mdiFruitPineapple },
  watermelon: { name: 'Watermelon', path: mdiFruitWatermelon },
  mushroom: { name: 'Mushroom', path: mdiMushroom },
  pumpkin: { name: 'Pumpkin', path: mdiPumpkin },
  leaf: { name: 'Leaf', path: mdiLeaf },
  maple: { name: 'Maple leaf', path: mdiLeafMaple },
  sprout: { name: 'Sprout', path: mdiSprout },
  flower: { name: 'Flower', path: mdiFlower },
  tulip: { name: 'Tulip', path: mdiFlowerTulip },
  cactus: { name: 'Cactus', path: mdiCactus },
  palm: { name: 'Palm tree', path: mdiPalmTree },
  pine: { name: 'Pine tree', path: mdiPineTree },
  mountains: { name: 'Mountains', path: mdiImageFilterHdr },
  tent: { name: 'Tent', path: mdiTent },
  beach: { name: 'Beach', path: mdiUmbrellaBeach },
  wave: { name: 'Wave', path: mdiWave },
  sailboat: { name: 'Sailboat', path: mdiSailBoat },
  anchor: { name: 'Anchor', path: mdiAnchor },
  compass: { name: 'Compass', path: mdiCompass },
  earth: { name: 'Earth', path: mdiEarth },
  sun: { name: 'Sun', path: mdiWhiteBalanceSunny },
  moon: { name: 'Moon', path: mdiMoonWaningCrescent },
  sparkle: { name: 'Sparkle', path: mdiStarFourPoints },
  star: { name: 'Star', path: mdiStar },
  cloud: { name: 'Cloud', path: mdiCloud },
  lightning: { name: 'Lightning', path: mdiWeatherLightning },
  snowflake: { name: 'Snowflake', path: mdiSnowflake },
  fire: { name: 'Fire', path: mdiFire },
  heart: { name: 'Heart', path: mdiHeart },
  cat: { name: 'Cat', path: mdiCat },
  dog: { name: 'Dog', path: mdiDog },
  paw: { name: 'Paw', path: mdiPaw },
  owl: { name: 'Owl', path: mdiOwl },
  bee: { name: 'Bee', path: mdiBee },
  butterfly: { name: 'Butterfly', path: mdiButterfly },
  duck: { name: 'Duck', path: mdiDuck },
  turtle: { name: 'Turtle', path: mdiTurtle },
  fish: { name: 'Fish', path: mdiFish },
  jellyfish: { name: 'Jellyfish', path: mdiJellyfish },
  rocket: { name: 'Rocket', path: mdiRocketLaunch },
  orbit: { name: 'Orbit', path: mdiOrbit },
  robot: { name: 'Robot', path: mdiRobot },
  ghost: { name: 'Ghost', path: mdiGhost },
  skull: { name: 'Skull', path: mdiSkull },
  crown: { name: 'Crown', path: mdiCrown },
  diamond: { name: 'Diamond', path: mdiDiamondStone },
  music: { name: 'Music', path: mdiMusic },
  guitar: { name: 'Guitar', path: mdiGuitarAcoustic },
  headphones: { name: 'Headphones', path: mdiHeadphones },
  gamepad: { name: 'Gamepad', path: mdiGamepadVariant },
  dice: { name: 'Dice', path: mdiDice5 },
  knight: { name: 'Chess knight', path: mdiChessKnight },
  puzzle: { name: 'Puzzle', path: mdiPuzzle },
  bicycle: { name: 'Bicycle', path: mdiBicycle },
  camera: { name: 'Camera', path: mdiCamera },
  palette: { name: 'Palette', path: mdiPalette },
  lightbulb: { name: 'Light bulb', path: mdiLightbulbOn },
  party: { name: 'Party', path: mdiPartyPopper },
  happy: { name: 'Happy', path: mdiEmoticonHappy },
  cool: { name: 'Cool', path: mdiEmoticonCool },
  peace: { name: 'Peace', path: mdiPeace },
  yinYang: { name: 'Yin yang', path: mdiYinYang },
  infinity: { name: 'Infinity', path: mdiInfinity },
  home: { name: 'Home', path: mdiHome },
  nozzle: { name: '3D printer nozzle', path: mdiPrinter3dNozzle },
  cube: { name: 'Cube', path: mdiCube },
  hexagons: { name: 'Hexagons', path: mdiHexagonMultiple },
} satisfies Record<string, { name: string; path: string }>;
