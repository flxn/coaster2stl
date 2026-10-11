import generateModel from '@/tool/generator';
import { serializePart } from '../geometry/parts';
import type { ModelWarning, WarningParams } from '../types';
import type { GenerateRequest, GenerateResponse } from './protocol';

// `{ transfer }` hands the vertex buffers over without copying them
const respond = (message: GenerateResponse, transfer: Transferable[] = []) => self.postMessage(message, { transfer });

self.addEventListener('message', async (event: MessageEvent<GenerateRequest>) => {
  const { requestId, options } = event.data;
  const warnings: ModelWarning[] = [];
  const context = {
    warn(code: string, params?: WarningParams) {
      if (!warnings.some((warning) => warning.code === code)) {
        warnings.push({ code, params });
      }
    },
  };

  try {
    const started = performance.now();
    const parts = (await generateModel(options as Parameters<typeof generateModel>[0], context)).map(serializePart);
    respond(
      {
        type: 'result',
        requestId,
        parts,
        warnings,
        duration: performance.now() - started,
      },
      parts.map((part) => part.positions.buffer),
    );
  } catch (error) {
    console.error('3D model generation failed:', error);
    respond({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
