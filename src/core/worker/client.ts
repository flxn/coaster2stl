import { deserializePart } from '../geometry/parts';
import type { ModelPart, ModelWarning } from '../types';
import type { GenerateRequest, GenerateResponse } from './protocol';

export interface GenerateResult {
  parts: ModelPart[];
  warnings: ModelWarning[];
  duration: number;
}

interface Pending {
  resolve: (result: GenerateResult) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let lastRequestId = 0;
const pending = new Map<number, Pending>();

const rejectAll = (error: Error) => {
  pending.forEach((entry) => entry.reject(error));
  pending.clear();
};

const getWorker = (): Worker => {
  if (worker) {
    return worker;
  }
  worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<GenerateResponse>) => {
    const data = event.data;
    const entry = pending.get(data.requestId);
    if (!entry) {
      return;
    }
    pending.delete(data.requestId);
    if (data.type === 'error') {
      entry.reject(new Error(data.message || 'Model generation failed'));
    } else {
      entry.resolve({
        parts: data.parts.map(deserializePart),
        warnings: data.warnings,
        duration: data.duration,
      });
    }
  });
  worker.addEventListener('error', (event) => {
    rejectAll(new Error(event.message || 'Model worker crashed'));
    // start a fresh worker for the next request
    worker?.terminate();
    worker = null;
  });
  return worker;
};

/**
 * Generates the model for `options` in the worker.
 * Each call resolves with the result of exactly its own request, so concurrent callers never mix results.
 */
export const requestModel = (options: unknown): Promise<GenerateResult> => new Promise((resolve, reject) => {
  lastRequestId += 1;
  const message: GenerateRequest = { requestId: lastRequestId, options };
  pending.set(message.requestId, { resolve, reject });
  getWorker().postMessage(message);
});
