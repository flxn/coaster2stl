import * as THREE from 'three';

/**
 * A mug to put on the coaster in the preview (never exported): shows at a glance whether the
 * coaster is big enough. The default is a common 11 oz (325 ml) mug: 83 mm across the rim and
 * 96 mm high; its foot is about 75 mm wide (typical mugs: 80–100 mm rim, 76–89 mm base).
 */
export const createMug = ({ diameter = 83, height = 96, color = 0xf6f3ee, z = 0 } = {}): THREE.Group => {
  const radius = diameter / 2;
  const wall = 3.5;
  const material = new THREE.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0, envMapIntensity: 0.6, side: THREE.DoubleSide,
  });
  const coffee = new THREE.MeshStandardMaterial({ color: 0x3b2316, roughness: 0.15, metalness: 0 });

  // profile from the center of the bottom, up the outside, over the lip and down the inside
  const profile = [
    [0, 0], [radius - 4, 0], [radius - 1.5, 0.8], [radius, 4], [radius + 0.6, height - 2], [radius + 0.2, height],
    [radius - wall + 0.4, height], [radius - wall, height - 3], [radius - wall - 0.4, 8], [radius - wall - 3, 6], [0, 6],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), material);
  body.rotation.x = Math.PI / 2;

  const surface = new THREE.Mesh(new THREE.CircleGeometry(radius - wall - 0.2, 64), coffee);
  surface.position.z = height - 14;

  // a ring standing upright on the +X side, its ends sunk into the wall
  const handleRadius = height * 0.24;
  const arc = Math.PI * 1.1;
  const handleGeometry = new THREE.TorusGeometry(handleRadius, 5, 20, 48, arc);
  handleGeometry.rotateZ(-arc / 2);
  handleGeometry.rotateX(Math.PI / 2);
  const handle = new THREE.Mesh(handleGeometry, material);
  handle.position.set(radius - handleRadius * 0.25, 0, height * 0.5);

  const mug = new THREE.Group();
  mug.add(body, surface, handle);
  mug.position.z = z;
  mug.rotation.z = -Math.PI / 5;
  return mug;
};
