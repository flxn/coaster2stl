/**
 * Helpers for the plain-object option trees that tools use for their settings.
 * Number fields hold NaN while they are empty (see UiNumberField).
 */

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const cloneOptions = <T>(options: T): T => structuredClone(options);

/**
 * True if every numeric option (judged by the defaults) currently holds a finite number.
 * An empty number field must not trigger a live re-generation.
 */
export const hasValidNumbers = (options: unknown, defaults: unknown): boolean => {
  if (typeof defaults === 'number') {
    return typeof options === 'number' && Number.isFinite(options);
  }
  if (isPlainObject(defaults)) {
    const source = isPlainObject(options) ? options : {};
    return Object.keys(defaults).every((key) => hasValidNumbers(source[key], defaults[key]));
  }
  return true;
};

/**
 * Copies values from `source` into `target`, but only for keys that exist in `target` and only
 * when the type matches, so imported settings files can never add junk or break the option tree.
 */
export const mergeKnownOptions = (target: PlainObject, source: unknown): void => {
  if (!isPlainObject(source)) {
    return;
  }
  Object.keys(target).forEach((key) => {
    const current = target[key];
    const incoming = source[key];
    if (incoming === undefined) {
      return;
    }
    if (isPlainObject(current)) {
      mergeKnownOptions(current, incoming);
    } else if (typeof current === 'number' && (typeof incoming === 'number' || incoming === null)) {
      // JSON turns NaN (an empty field) into null
      target[key] = incoming ?? Number.NaN;
    } else if (typeof current === typeof incoming) {
      target[key] = incoming;
    }
  });
};

/**
 * Returns `value` as a finite number within [min, max], or `fallback` if it is not a number.
 * Generators use this so empty, negative or far too large inputs still produce a valid model.
 */
export const toNumber = (value: unknown, fallback: number, min = -Infinity, max = Infinity): number => {
  const number = Number(value);
  if (value === null || value === '' || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
};

/** Rounds to one decimal, for values shown in warnings. */
export const round1 = (value: number): number => Math.round(value * 10) / 10;
