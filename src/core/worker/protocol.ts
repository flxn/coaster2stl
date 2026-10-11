import type { SerializedPart } from '../geometry/parts';
import type { ModelWarning } from '../types';

export interface GenerateRequest {
  requestId: number;
  options: unknown;
}

export type GenerateResponse =
  | { type: 'result'; requestId: number; parts: SerializedPart[]; warnings: ModelWarning[]; duration: number }
  | { type: 'error'; requestId: number; message: string };
