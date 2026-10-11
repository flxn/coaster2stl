import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setFontFileReader } from '@/core/geometry/fonts';

// in tests, `?url` imports resolve to project paths like /src/core/assets/fonts/Inter_400Regular.ttf
setFontFileReader(async (url) => {
  const data = await readFile(resolve(process.cwd(), `.${url.split('?')[0]}`));
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
});
