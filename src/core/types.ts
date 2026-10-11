import type { BufferGeometry } from 'three';

/**
 * 'base' parts get the base color in the preview (and the dimension ruler measures them),
 * 'detail' parts (text, border, relief, …) the contrasting color.
 */
export type PartRole = 'base' | 'detail';

export interface ModelPart {
  /** file name used when the parts are exported separately, e.g. 'base' or 'text' */
  name: string;
  role: PartRole;
  /** preview color; defaults to white for base parts and near black for detail parts */
  color?: number;
  /**
   * Final geometry in millimeters, already positioned:
   * X = width (left → right), Y = height (front → back), Z = up with the print bed at z = 0.
   */
  geometry: BufferGeometry;
}

export type WarningParams = Record<string, string | number>;

/** An automatic adjustment the generator made to keep the model valid. */
export interface ModelWarning {
  code: string;
  params?: WarningParams;
}

export interface GenerateContext {
  /**
   * Reports an adjustment (e.g. a corner radius that had to be reduced).
   * It is shown in the preview, and next to the setting via `useModelWarnings().warningFor(code)`.
   * The texts come from the i18n keys `warnings.<code>` and `warnings.<code>Help`.
   */
  warn(code: string, params?: WarningParams): void;
}

/** Builds the model from the tool options. Runs inside a web worker, so it must not touch the DOM. */
export type Generator<Options> = (options: Options, context: GenerateContext) => ModelPart[] | Promise<ModelPart[]>;
