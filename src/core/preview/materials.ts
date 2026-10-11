import * as THREE from 'three';
import type { ModelPart } from '../types';

const DEFAULT_COLORS = {
  base: 0xfafafa,
  detail: 0x111111,
};

let noiseTexture: THREE.DataTexture | null = null;

const getNoiseTexture = (): THREE.DataTexture => {
  if (noiseTexture) {
    return noiseTexture;
  }
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const value = 55 + Math.floor(Math.random() * 200);
    data.set([value, value, value, 255], i * 4);
  }
  noiseTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  noiseTexture.wrapS = THREE.RepeatWrapping;
  noiseTexture.wrapT = THREE.RepeatWrapping;
  noiseTexture.repeat.set(6, 6);
  noiseTexture.colorSpace = THREE.NoColorSpace;
  noiseTexture.needsUpdate = true;
  return noiseTexture;
};

/** Shades faint layer lines on the sides and extrusion lines on top, like an FDM print. */
const addFdmShader = (material: THREE.MeshStandardMaterial, type: 'base' | 'detail') => {
  const sideStrength = type === 'base' ? 0.12 : 0.07;
  const topStrength = type === 'base' ? 0.08 : 0.04;
  const layerFrequency = 31.4; // roughly 0.2 mm visual layer height
  const extrusionFrequency = 14.0; // roughly 0.45 mm visual extrusion width

  material.onBeforeCompile = (shader) => {
    const varyings = '#include <common>\nvarying vec3 vFdmPosition;\nvarying vec3 vFdmNormal;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', varyings)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvFdmNormal = normalize(objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFdmPosition = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', varyings)
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        'vec3 fdmNormal = normalize(vFdmNormal);',
        'float fdmSideMask = pow(1.0 - abs(fdmNormal.z), 1.35);',
        'float fdmFlatMask = pow(abs(fdmNormal.z), 2.0);',
        'float fdmJitter = sin(vFdmPosition.x * 0.27 + vFdmPosition.y * 0.19) * 0.035;',
        `float fdmLayerWave = 0.5 + 0.5 * sin((vFdmPosition.z + fdmJitter) * ${layerFrequency.toFixed(3)});`,
        'float fdmLayerLine = pow(fdmLayerWave, 8.0) - 0.38;',
        'float fdmPathWobble = sin(vFdmPosition.y * 0.21 + vFdmPosition.z * 0.43) * 0.06;',
        `float fdmPathWave = 0.5 + 0.5 * sin((vFdmPosition.x + fdmPathWobble) * ${extrusionFrequency.toFixed(3)});`,
        'float fdmPathLine = pow(fdmPathWave, 3.0) - 0.42;',
        `float fdmShade = (fdmLayerLine * fdmSideMask * ${sideStrength.toFixed(3)}) + (fdmPathLine * fdmFlatMask * ${topStrength.toFixed(3)});`,
        'diffuseColor.rgb *= clamp(1.0 + fdmShade, 0.78, 1.18);',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => `fdm-preview-${type}`;
};

const createPlasticMaterial = (color: number, type: 'base' | 'detail'): THREE.MeshStandardMaterial => {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0,
    // rough enough that dark details read black from the angled default view instead of glaring
    roughness: type === 'base' ? 0.86 : 0.8,
    envMapIntensity: type === 'base' ? 0.1 : 0.07,
    bumpMap: getNoiseTexture(),
    bumpScale: type === 'base' ? 0.04 : 0.02,
  });
  addFdmShader(material, type);
  return material;
};

/** A shaded preview mesh for a model part (the part geometry is shared, not copied). */
export const createPreviewMesh = (part: ModelPart): THREE.Mesh => {
  const color = part.color ?? DEFAULT_COLORS[part.role];
  const mesh = new THREE.Mesh(part.geometry, createPlasticMaterial(color, part.role));
  mesh.name = part.name;
  // the preview uses the role to find the base plate (e.g. for the dimension ruler)
  mesh.userData.role = part.role;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
