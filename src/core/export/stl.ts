import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import type { ModelPart } from '../types';
import { saveBlob } from './download';

export type StlFormat = 'binary' | 'ascii';

const exporter = new STLExporter();

const toStl = (object: THREE.Object3D, format: StlFormat): ArrayBuffer | string => {
  object.updateMatrixWorld(true);
  return format === 'binary'
    ? exporter.parse(object, { binary: true }).buffer as ArrayBuffer
    : exporter.parse(object, { binary: false });
};

const meshOf = (part: ModelPart) => new THREE.Mesh(part.geometry);

/**
 * Downloads the model: one STL with all parts, or a ZIP with one STL per part
 * (for multi-material printers, where each part gets its own filament).
 */
export const exportStl = async (
  parts: ModelPart[],
  { format, separateParts, filePrefix }: { format: StlFormat; separateParts: boolean; filePrefix: string },
): Promise<void> => {
  const timestamp = Date.now();
  if (separateParts) {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    parts.forEach((part) => {
      zip.file(`${filePrefix}-${part.name}-${timestamp}.stl`, toStl(meshOf(part), format));
    });
    saveBlob(await zip.generateAsync({ type: 'blob' }), `${filePrefix}-${timestamp}.zip`);
    return;
  }
  const group = new THREE.Group();
  parts.forEach((part) => group.add(meshOf(part)));
  saveBlob(new Blob([toStl(group, format)], { type: 'model/stl' }), `${filePrefix}-${timestamp}.stl`);
};
