import { parse, type Font } from 'opentype.js';

/**
 * The font library (TTF files in src/core/assets/fonts, all SIL Open Font License).
 * Fonts are parsed with opentype.js and loaded on first use, so unused fonts cost nothing.
 */
export const FONT_FAMILIES = {
  montserrat: { label: 'Montserrat', style: 'sans', regular: 'Montserrat_400Regular', bold: 'Montserrat_700Bold' },
  inter: { label: 'Inter', style: 'sans', regular: 'Inter_400Regular', bold: 'Inter_700Bold' },
  oswald: { label: 'Oswald', style: 'condensed', regular: 'Oswald_400Regular', bold: 'Oswald_600SemiBold' },
  playfair: { label: 'Playfair Display', style: 'serif', regular: 'PlayfairDisplay_400Regular', bold: 'PlayfairDisplay_700Bold' },
  righteous: { label: 'Righteous', style: 'display', regular: 'Righteous_400Regular', bold: 'Righteous_400Regular' },
  bungee: { label: 'Bungee', style: 'display', regular: 'Bungee_400Regular', bold: 'Bungee_400Regular' },
  lobster: { label: 'Lobster', style: 'script', regular: 'Lobster_400Regular', bold: 'Lobster_400Regular' },
  pacifico: { label: 'Pacifico', style: 'script', regular: 'Pacifico_400Regular', bold: 'Pacifico_400Regular' },
} as const;

export type FontFamilyId = keyof typeof FONT_FAMILIES;
export type FontWeight = 'regular' | 'bold';

export interface LoadedFont {
  font: Font;
  /** height of capital letters in font units, used to size text by cap height */
  capHeight: number;
  /** height of the tallest common letters (b, d, i, l, …) above the baseline, in font units */
  ascent: number;
  /** depth of descenders (g, p, y, …) below the baseline, in font units (positive) */
  descent: number;
}

const FONT_URLS = import.meta.glob<string>('../assets/fonts/*.ttf', { query: '?url', import: 'default', eager: true });

let readFile = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load font ${url}`);
  }
  return response.arrayBuffer();
};

/** Replaces how font files are read, e.g. from disk in tests (see src/test/setup.ts). */
export const setFontFileReader = (reader: (url: string) => Promise<ArrayBuffer>) => {
  readFile = reader;
};

export const isFontFamily = (value: unknown): value is FontFamilyId => typeof value === 'string' && value in FONT_FAMILIES;

const cache = new Map<string, Promise<LoadedFont>>();

export const fontKey = (family: FontFamilyId, weight: FontWeight) => FONT_FAMILIES[family][weight];

export const loadFont = (family: FontFamilyId, weight: FontWeight): Promise<LoadedFont> => {
  const key = fontKey(family, weight);
  let loaded = cache.get(key);
  if (!loaded) {
    const url = FONT_URLS[`../assets/fonts/${key}.ttf`];
    if (!url) {
      throw new Error(`Font ${key} is missing`);
    }
    loaded = readFile(url).then((buffer) => {
      const font = parse(buffer);
      const capHeight = font.tables.os2?.sCapHeight || font.ascender * 0.7;
      // measured from real glyphs: the font-wide ascender and descender include generous line spacing
      const extent = (chars: string, edge: 'yMax' | 'yMin') => Math.max(...Array.from(chars).map((char) => {
        const value = font.charToGlyph(char).getMetrics()[edge];
        return Number.isFinite(value) ? Math.abs(value) : 0;
      }));
      return {
        font,
        capHeight,
        ascent: Math.max(capHeight, extent('bdfhijklt', 'yMax')),
        descent: extent('gjpqy', 'yMin'),
      };
    });
    cache.set(key, loaded);
  }
  return loaded;
};

/** URL of a font file, e.g. to show font previews in the UI with the FontFace API. */
export const fontFileUrl = (family: FontFamilyId, weight: FontWeight): string => FONT_URLS[`../assets/fonts/${fontKey(family, weight)}.ttf`];
