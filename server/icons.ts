import * as mdi from '@mdi/js';
import * as simpleIcons from 'simple-icons';

/**
 * The icon library behind the artwork picker: all Material Design Icons (Apache 2.0) and all
 * Simple Icons brand logos (CC0; the brands themselves are trademarks of their owners).
 * Both use a 24×24 view box, so the generator treats them the same way.
 * The index lives in memory (about 11,000 icons); searching it takes well under a millisecond.
 */

export type IconSet = 'icons' | 'brands';

export interface IconEntry {
  id: string;
  name: string;
  set: IconSet;
  path: string;
  /** brand color (brands only) */
  hex?: string;
  /** lowercase words of the name and slug, for prefix matching */
  words: string[];
}

/** Shown first when nothing is searched yet: icons that make good coasters. */
const FEATURED = [
  'coffee', 'tea', 'glass-mug-variant', 'glass-cocktail', 'glass-wine', 'beer', 'bottle-wine', 'cup-water',
  'cupcake', 'ice-cream', 'fruit-citrus', 'leaf', 'flower', 'palm-tree', 'white-balance-sunny', 'moon-waning-crescent',
  'star-four-points', 'heart', 'paw', 'cat', 'dog', 'rocket-launch', 'skull', 'ghost', 'anchor', 'compass',
  'music', 'gamepad-variant', 'dice-5', 'pizza', 'cactus', 'mushroom',
];

const words = (camel: string) => camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2');

const buildIndex = (): IconEntry[] => {
  const entries: IconEntry[] = [];
  Object.entries(mdi).forEach(([key, path]) => {
    if (!key.startsWith('mdi') || typeof path !== 'string') return;
    const name = words(key.slice(3));
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    entries.push({
      id: `mdi:${slug}`, name, set: 'icons', path, words: name.toLowerCase().split(' '),
    });
  });
  Object.entries(simpleIcons).forEach(([key, icon]) => {
    if (!key.startsWith('si') || !icon || typeof icon !== 'object') return;
    const { title, slug, hex, path } = icon as { title: string; slug: string; hex: string; path: string };
    entries.push({
      id: `brands:${slug}`,
      name: title,
      set: 'brands',
      path,
      hex: `#${hex}`,
      words: [...title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean), slug],
    });
  });
  return entries;
};

let index: IconEntry[] | null = null;
const getIndex = () => {
  index ??= buildIndex();
  return index;
};

/**
 * Searches the library. Every word of the query has to start a word of the name ("cat" finds "Cat"
 * and "Cat Outline", not "Medication"); exact names and names that start with the query rank first,
 * filled icons before their outline variants.
 */
export const searchIcons = ({
  query = '', set, offset = 0, limit = 60,
}: { query?: string; set?: IconSet; offset?: number; limit?: number }) => {
  const entries = getIndex().filter((entry) => !set || entry.set === set);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let results: IconEntry[];
  if (!terms.length) {
    const featured = FEATURED.map((slug) => entries.find((entry) => entry.id === `mdi:${slug}`)).filter((entry): entry is IconEntry => !!entry);
    results = [...featured, ...entries.filter((entry) => !featured.includes(entry))];
  } else {
    const phrase = terms.join(' ');
    const score = (entry: IconEntry) => {
      const name = entry.name.toLowerCase();
      let value = 0;
      if (name === phrase) value += 100;
      else if (name.startsWith(phrase)) value += 50;
      if (name.split(' ').includes(terms[0])) value += 20;
      if (/outline|off\b/.test(name)) value -= 10;
      return value - name.length * 0.2;
    };
    results = entries
      .filter((entry) => terms.every((term) => entry.words.some((word) => word.startsWith(term))))
      .map((entry) => ({ entry, score: score(entry) }))
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => entry);
  }
  return {
    total: results.length,
    items: results.slice(offset, offset + limit).map(({
      id, name, set: iconSet, path, hex,
    }) => ({
      id, name, set: iconSet, path, hex,
    })),
  };
};
