import * as THREE from 'three';
import type { ModelPart, PartRole } from '../types';

/** A model part as it is sent from the worker: only the triangle positions, as a transferable array. */
export interface SerializedPart {
  name: string;
  role: PartRole;
  color?: number;
  positions: Float32Array;
}

export const serializePart = (part: ModelPart): SerializedPart => {
  const source = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
  const attribute = source.getAttribute('position');
  const positions = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i += 1) {
    positions[i * 3] = attribute.getX(i);
    positions[i * 3 + 1] = attribute.getY(i);
    positions[i * 3 + 2] = attribute.getZ(i);
  }
  return {
    name: part.name,
    role: part.role,
    color: part.color,
    positions,
  };
};

export const deserializePart = (part: SerializedPart): ModelPart => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return {
    name: part.name,
    role: part.role,
    color: part.color,
    geometry,
  };
};
