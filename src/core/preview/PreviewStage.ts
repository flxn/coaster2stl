import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ModelPart } from '../types';
import { createPreviewMesh } from './materials';

export type ViewMode = '3d' | '2d';
export type PointerMode = 'rotate' | 'pan' | 'zoom';
export type CubeFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export type Theme = 'light' | 'dark';

interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface Ruler {
  axis: 'x' | 'y';
  angle: number;
  value: number;
  extA0: ScreenPoint;
  extA1: ScreenPoint;
  extB0: ScreenPoint;
  extB1: ScreenPoint;
  start: ScreenPoint;
  end: ScreenPoint;
  label: ScreenPoint;
}

export interface FrameInfo {
  /** CSS transform for the orientation cube */
  cube: string;
  rulers: Ruler[];
}

interface View {
  target: THREE.Vector3;
  radius: number;
  azimuth: number;
  elevation: number;
  fov: number;
}

interface Framing {
  center: THREE.Vector3;
  radius: number;
  points: THREE.Vector3[];
}

interface Limits {
  x: number;
  y: number;
}

const FOV_3D = 35;
const FOV_2D = 5;
const DEFAULT_AZIMUTH = THREE.MathUtils.degToRad(-30);
const DEFAULT_ELEVATION = THREE.MathUtils.degToRad(55);
const TOP_ELEVATION = Math.PI / 2 - 1e-4;
// fraction of the viewport (in NDC) the framed model may use horizontally / vertically
const FIT_LIMITS_3D: Limits = { x: 0.88, y: 0.8 };
const FIT_LIMITS_2D: Limits = { x: 0.84, y: 0.78 };
const PLACEHOLDER_BOX = new THREE.Box3(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 4));
const PNG_MAX_SIDE = 2400;

/* Grid colours are given as raw sRGB triplets so they match the CSS palette exactly. */
const THEMES = {
  dark: {
    minor: [0.66, 0.71, 0.74],
    major: [0.76, 0.81, 0.84],
    minorOpacity: 0.075,
    majorOpacity: 0.14,
    shadowOpacity: 0.42,
  },
  light: {
    minor: [0.33, 0.37, 0.44],
    major: [0.28, 0.32, 0.39],
    minorOpacity: 0.085,
    majorOpacity: 0.15,
    shadowOpacity: 0.17,
  },
} as const;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const easeOutCubic = (t: number) => 1 - ((1 - t) ** 3);

const wrapAngle = (angle: number) => {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
};

const createGridMaterial = () => new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uMinorColor: { value: new THREE.Vector3(...THEMES.light.minor) },
    uMajorColor: { value: new THREE.Vector3(...THEMES.light.major) },
    uMinorOpacity: { value: THEMES.light.minorOpacity },
    uMajorOpacity: { value: THEMES.light.majorOpacity },
    uMinorStep: { value: 10 },
    uMajorStep: { value: 50 },
    uFadeStart: { value: 140 },
    uFadeEnd: { value: 420 },
  },
  vertexShader: /* glsl */`
    varying vec2 vPos;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vPos = world.xy;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uMinorColor;
    uniform vec3 uMajorColor;
    uniform float uMinorOpacity;
    uniform float uMajorOpacity;
    uniform float uMinorStep;
    uniform float uMajorStep;
    uniform float uFadeStart;
    uniform float uFadeEnd;
    varying vec2 vPos;

    float gridLine(vec2 coord, float width) {
      vec2 derivative = fwidth(coord);
      vec2 grid = abs(fract(coord - 0.5) - 0.5) / derivative;
      return 1.0 - min(min(grid.x, grid.y) / width, 1.0);
    }

    void main() {
      vec2 minorCoord = vPos / uMinorStep;
      vec2 majorCoord = vPos / uMajorStep;
      vec2 lod = fwidth(minorCoord);
      float minorVisibility = 1.0 - smoothstep(0.18, 0.45, max(lod.x, lod.y));
      float minorAlpha = gridLine(minorCoord, 1.0) * uMinorOpacity * minorVisibility;
      float majorAlpha = gridLine(majorCoord, 1.25) * uMajorOpacity;
      float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, length(vPos));
      float alpha = max(minorAlpha, majorAlpha) * fade;
      if (alpha < 0.002) discard;
      gl_FragColor = vec4(majorAlpha >= minorAlpha ? uMajorColor : uMinorColor, alpha);
    }
  `,
});

/** Crops fully transparent rows and columns from the edges of a canvas. */
const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  const rowBlank = (y: number) => {
    for (let x = 0; x < width; x += 1) if (alpha(x, y) !== 0) return false;
    return true;
  };
  const columnBlank = (x: number, top: number, bottom: number) => {
    for (let y = top; y < bottom; y += 1) if (alpha(x, y) !== 0) return false;
    return true;
  };
  let top = 0;
  let bottom = height;
  let left = 0;
  let right = width;
  while (top < bottom && rowBlank(top)) top += 1;
  while (bottom - 1 > top && rowBlank(bottom - 1)) bottom -= 1;
  while (left < right && columnBlank(left, top, bottom)) left += 1;
  while (right - 1 > left && columnBlank(right - 1, top, bottom)) right -= 1;

  const copy = document.createElement('canvas');
  copy.width = right - left;
  copy.height = bottom - top;
  copy.getContext('2d')!.putImageData(ctx.getImageData(left, top, copy.width, copy.height), 0, 0);
  return copy;
};

export interface PreviewStageOptions {
  theme?: Theme;
  onFrame?: (info: FrameInfo) => void;
  onViewModeChange?: (mode: ViewMode) => void;
}

/**
 * Owns the WebGL preview: renderer, camera, controls, lights, grid and the group that holds
 * the generated model. Rendering happens on demand (camera moves, model updates, resizes)
 * instead of a permanent 60 fps loop.
 */
export default class PreviewStage {
  private container: HTMLElement;

  private onFrame: PreviewStageOptions['onFrame'];

  private onViewModeChange: PreviewStageOptions['onViewModeChange'];

  private viewMode: ViewMode = '3d';

  private pointerMode: PointerMode = 'rotate';

  private hasModel = false;

  private bounds: { box: THREE.Box3; baseBox: THREE.Box3 } | null = null;

  private raf = 0;

  private tween: { from: View; to: View; start: number; duration: number } | null = null;

  private modelAnimation: { start: number; duration: number } | null = null;

  private interacting = false;

  private userMovedCamera = false;

  private disposed = false;

  private framing: Framing;

  private tmpVector = new THREE.Vector3();

  private probe: THREE.PerspectiveCamera | null = null;

  private renderer: THREE.WebGLRenderer;

  private scene: THREE.Scene;

  private environmentMap: THREE.Texture;

  private camera: THREE.PerspectiveCamera;

  private controls: OrbitControls;

  private modelGroup: THREE.Group;

  /** preview-only objects (e.g. a mug on a coaster): shown, but never measured, framed or exported */
  private propGroup: THREE.Group;

  private shadowPlane!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;

  private grid!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, { theme = 'light', onFrame, onViewModeChange }: PreviewStageOptions = {}) {
    this.container = container;
    this.onFrame = onFrame;
    this.onViewModeChange = onViewModeChange;
    this.framing = this.computeFraming(PLACEHOLDER_BOX);

    this.requestRender = this.requestRender.bind(this);
    this.frame = this.frame.bind(this);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'preview-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.environmentMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();
    this.scene.environment = this.environmentMap;

    this.createLights();
    this.createGround();

    this.modelGroup = new THREE.Group();
    this.modelGroup.name = 'model';
    this.scene.add(this.modelGroup);

    this.propGroup = new THREE.Group();
    this.propGroup.name = 'props';
    this.scene.add(this.propGroup);

    this.camera = new THREE.PerspectiveCamera(FOV_3D, width / height, 1, 5000);
    // Z-up like a slicer: the model lies flat on the build plate.
    this.camera.up.set(0, 0, 1);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.14;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 6000;
    this.controls.rotateSpeed = 0.85;
    this.controls.addEventListener('change', this.requestRender);
    this.controls.addEventListener('start', () => {
      this.interacting = true;
      this.userMovedCamera = true;
      this.tween = null;
      this.container.classList.add('is-dragging');
      this.requestRender();
    });
    this.controls.addEventListener('end', () => {
      this.interacting = false;
      this.container.classList.remove('is-dragging');
      this.requestRender();
    });

    this.setView(this.homeView());
    this.setTheme(theme);
    this.applyControlMapping();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.renderNow();
  }

  /* ------------------------------------------------------------------ */
  /* Scene setup                                                         */
  /* ------------------------------------------------------------------ */

  private createLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xaeb7c4, 0.5));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
    // far enough away that the shadow camera sees the whole model
    keyLight.position.set(-3.2, -2.1, 2.2).multiplyScalar(100);
    PreviewStage.configureShadow(keyLight, 2048);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.28);
    fillLight.position.set(1.7, 1.6, 1.1);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xdde4ef, 0.45);
    rimLight.position.set(1.3, -2.2, -1.3);
    this.scene.add(rimLight);

    const grazingLight = new THREE.DirectionalLight(0xfff7ef, 0.6);
    grazingLight.position.set(3.4, -3.2, 0.45);
    this.scene.add(grazingLight);

    // lights the underside from a low angle; its shadows make pockets readable in the bottom view
    // (all downward faces would otherwise look the same)
    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.9);
    bottomLight.position.set(-2.2, -1.5, -1.9).multiplyScalar(100);
    PreviewStage.configureShadow(bottomLight, 1024);
    this.scene.add(bottomLight);
  }

  private static configureShadow(light: THREE.DirectionalLight, mapSize: number) {
    light.castShadow = true;
    light.shadow.mapSize.set(mapSize, mapSize);
    Object.assign(light.shadow.camera, {
      near: 1, far: 1200, left: -180, right: 180, top: 180, bottom: -180,
    });
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.02;
  }

  private createGround() {
    this.shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2 }),
    );
    this.shadowPlane.position.z = -0.8;
    this.shadowPlane.receiveShadow = true;
    this.shadowPlane.renderOrder = 1;
    this.scene.add(this.shadowPlane);

    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), createGridMaterial());
    this.grid.position.z = -0.85;
    this.grid.renderOrder = 0;
    this.scene.add(this.grid);
  }

  setTheme(theme: Theme) {
    const settings = THEMES[theme] || THEMES.light;
    const { uniforms } = this.grid.material;
    uniforms.uMinorColor.value.set(...settings.minor);
    uniforms.uMajorColor.value.set(...settings.major);
    uniforms.uMinorOpacity.value = settings.minorOpacity;
    uniforms.uMajorOpacity.value = settings.majorOpacity;
    this.shadowPlane.material.opacity = settings.shadowOpacity;
    this.requestRender();
  }

  /* ------------------------------------------------------------------ */
  /* Model handling                                                      */
  /* ------------------------------------------------------------------ */

  clearModel() {
    [...this.modelGroup.children].forEach((child) => {
      this.modelGroup.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => material.dispose());
        }
      });
    });
    this.hasModel = false;
    this.bounds = null;
    this.requestRender();
  }

  /**
   * Replaces the shown model.
   * @param options.fit frame the camera on the model
   * @param options.animate play the drop-in animation
   */
  setModel(parts: ModelPart[], { fit = false, animate = false } = {}) {
    this.clearModel();
    parts.forEach((part) => this.modelGroup.add(createPreviewMesh(part)));

    this.modelGroup.position.set(0, 0, 0);
    this.modelGroup.scale.setScalar(1);
    this.modelAnimation = null;
    this.scene.updateMatrixWorld(true);

    const box = new THREE.Box3();
    const baseBox = new THREE.Box3();
    this.modelGroup.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const nodeBox = new THREE.Box3().setFromObject(node);
      box.union(nodeBox);
      if (node.userData.role === 'base') {
        baseBox.union(nodeBox);
      }
    });

    this.hasModel = !box.isEmpty();
    if (!this.hasModel) {
      this.bounds = null;
      this.requestRender();
      return;
    }

    const previousRadius = this.framing.radius;
    this.bounds = { box, baseBox: baseBox.isEmpty() ? box.clone() : baseBox };
    this.framing = this.computeFraming(this.withProps(box), this.bounds.baseBox);

    const sizeChanged = Math.abs(this.framing.radius - previousRadius) / previousRadius > 0.15;
    if (fit) {
      this.userMovedCamera = false;
      this.animateTo(this.viewMode === '2d' ? this.topView() : this.homeView(), animate ? 900 : 0);
    } else if (sizeChanged && !this.userMovedCamera) {
      this.animateTo(this.viewMode === '2d' ? this.topView() : this.homeView(), 520);
    }

    if (animate) {
      this.modelAnimation = { start: performance.now(), duration: 620 };
    }
    this.requestRender();
  }

  /** The model bounds extended by the preview-only objects, so the camera frames both. */
  private withProps(box: THREE.Box3): THREE.Box3 {
    const result = box.clone();
    if (this.propGroup.children.length) {
      this.propGroup.updateMatrixWorld(true);
      result.union(new THREE.Box3().setFromObject(this.propGroup));
    }
    return result;
  }

  /** Replaces the preview-only objects (disposing the old ones) and frames the camera on everything. */
  setProps(objects: THREE.Object3D[]) {
    const hadProps = this.propGroup.children.length > 0;
    [...this.propGroup.children].forEach((child) => {
      this.propGroup.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => material.dispose());
        }
      });
    });
    objects.forEach((object) => {
      object.traverse((node) => {
        node.castShadow = true;
        node.receiveShadow = true;
      });
      this.propGroup.add(object);
    });
    if (this.bounds && (hadProps || objects.length)) {
      this.framing = this.computeFraming(this.withProps(this.bounds.box), this.bounds.baseBox);
      this.userMovedCamera = false;
      this.animateTo(this.viewMode === '2d' ? this.topView() : this.homeView(), 600);
    }
    this.requestRender();
  }

  getModelSize(): THREE.Vector3 | null {
    return this.bounds ? this.bounds.box.getSize(new THREE.Vector3()) : null;
  }

  /* ------------------------------------------------------------------ */
  /* Camera views                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Points that should be visible when the camera frames the model:
   * the corners of the model bounds plus the dimension rulers in front of and left of it.
   */
  private computeFraming(box: THREE.Box3, baseBox = box): Framing {
    const size = baseBox.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y);
    const rulerDepth = Math.max(8, span * 0.09) + Math.max(5, span * 0.06) + 4;
    const framed = box.clone();
    framed.min.y = Math.min(framed.min.y, baseBox.min.y - rulerDepth);
    framed.min.x = Math.min(framed.min.x, baseBox.min.x - rulerDepth);
    const points: THREE.Vector3[] = [];
    [framed.min.x, framed.max.x].forEach((x) => {
      [framed.min.y, framed.max.y].forEach((y) => {
        [framed.min.z, framed.max.z].forEach((z) => points.push(new THREE.Vector3(x, y, z)));
      });
    });
    const sphere = framed.getBoundingSphere(new THREE.Sphere());
    return {
      center: framed.getCenter(new THREE.Vector3()),
      radius: Math.max(sphere.radius, 10),
      points,
    };
  }

  /** Positions a throwaway camera for the given view; used for framing calculations. */
  private probeCamera(view: Omit<View, 'radius'>, radius: number): THREE.PerspectiveCamera {
    if (!this.probe) {
      this.probe = new THREE.PerspectiveCamera(view.fov, this.camera.aspect, 0.1, 100000);
      this.probe.up.set(0, 0, 1);
    }
    const camera = this.probe;
    camera.fov = view.fov;
    camera.aspect = this.camera.aspect;
    camera.updateProjectionMatrix();
    const cosElevation = Math.cos(view.elevation);
    camera.position.set(
      cosElevation * Math.sin(view.azimuth),
      -cosElevation * Math.cos(view.azimuth),
      Math.sin(view.elevation),
    ).multiplyScalar(radius).add(view.target);
    camera.lookAt(view.target);
    camera.updateMatrixWorld();
    return camera;
  }

  /** Screen-space (NDC) bounds of the framing points for a camera placement. */
  private projectedBounds(view: Omit<View, 'radius'>, radius: number) {
    const camera = this.probeCamera(view, radius);
    const projected = new THREE.Vector3();
    const bounds = {
      minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, behind: false,
    };
    this.framing.points.forEach((point) => {
      projected.copy(point).project(camera);
      if (projected.z >= 1) bounds.behind = true;
      bounds.minX = Math.min(bounds.minX, projected.x);
      bounds.maxX = Math.max(bounds.maxX, projected.x);
      bounds.minY = Math.min(bounds.minY, projected.y);
      bounds.maxY = Math.max(bounds.maxY, projected.y);
    });
    return bounds;
  }

  /** Smallest camera distance at which all framing points fit inside the given NDC limits. */
  private fitRadius(view: Omit<View, 'radius'>, limits: Limits): number {
    const fits = (radius: number) => {
      const b = this.projectedBounds(view, radius);
      return !b.behind
        && Math.max(Math.abs(b.minX), Math.abs(b.maxX)) <= limits.x
        && Math.max(Math.abs(b.minY), Math.abs(b.maxY)) <= limits.y;
    };
    let low = 1;
    let high = 100000;
    for (let i = 0; i < 28; i += 1) {
      const middle = (low + high) / 2;
      if (fits(middle)) {
        high = middle;
      } else {
        low = middle;
      }
    }
    return high;
  }

  /**
   * Fits the framing points into the viewport. Perspective makes the 3D center project
   * off-center, so the target is nudged until the projected bounds are centered on screen.
   */
  private framedView(view: Pick<View, 'azimuth' | 'elevation' | 'fov'>, limits: Limits): View {
    const result: View = { target: this.framing.center.clone(), radius: 0, ...view };
    for (let i = 0; i < 3; i += 1) {
      result.radius = this.fitRadius(result, limits);
      const b = this.projectedBounds(result, result.radius);
      const centerX = (b.minX + b.maxX) / 2;
      const centerY = (b.minY + b.maxY) / 2;
      if (Math.abs(centerX) < 0.01 && Math.abs(centerY) < 0.01) {
        break;
      }
      const camera = this.probeCamera(result, result.radius);
      const halfHeight = result.radius * Math.tan(THREE.MathUtils.degToRad(result.fov) / 2);
      const halfWidth = halfHeight * camera.aspect;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      result.target
        .addScaledVector(right, centerX * halfWidth)
        .addScaledVector(up, centerY * halfHeight);
    }
    result.radius = this.fitRadius(result, limits);
    return result;
  }

  private homeView(): View {
    return this.framedView({ azimuth: DEFAULT_AZIMUTH, elevation: DEFAULT_ELEVATION, fov: FOV_3D }, FIT_LIMITS_3D);
  }

  private topView(): View {
    return this.framedView({ azimuth: 0, elevation: TOP_ELEVATION, fov: FOV_2D }, FIT_LIMITS_2D);
  }

  private faceView(face: CubeFace): View {
    const views: Record<CubeFace, { azimuth: number; elevation: number }> = {
      '+z': { azimuth: 0, elevation: TOP_ELEVATION },
      '-z': { azimuth: 0, elevation: -TOP_ELEVATION },
      '-y': { azimuth: 0, elevation: 0.0001 },
      '+y': { azimuth: Math.PI, elevation: 0.0001 },
      '+x': { azimuth: Math.PI / 2, elevation: 0.0001 },
      '-x': { azimuth: -Math.PI / 2, elevation: 0.0001 },
    };
    return this.framedView({ fov: FOV_3D, ...views[face] }, FIT_LIMITS_3D);
  }

  private currentView(): View {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const radius = offset.length();
    return {
      target: this.controls.target.clone(),
      radius,
      azimuth: Math.atan2(offset.x, -offset.y),
      elevation: Math.asin(THREE.MathUtils.clamp(offset.z / radius, -1, 1)),
      fov: this.camera.fov,
    };
  }

  private setView(view: View) {
    const cosElevation = Math.cos(view.elevation);
    const offset = new THREE.Vector3(
      cosElevation * Math.sin(view.azimuth),
      -cosElevation * Math.cos(view.azimuth),
      Math.sin(view.elevation),
    ).multiplyScalar(view.radius);
    this.controls.target.copy(view.target);
    this.camera.position.copy(view.target).add(offset);
    this.camera.fov = view.fov;
    this.updateClipPlanes(view.radius);
    this.camera.lookAt(view.target);
  }

  private updateClipPlanes(radius = this.camera.position.distanceTo(this.controls.target)) {
    this.camera.near = Math.max(0.5, radius * 0.02);
    this.camera.far = Math.max(2000, radius * 25);
    this.camera.updateProjectionMatrix();
  }

  /** OrbitControls keeps damping momentum in private fields; clear it so tweens start cleanly. */
  private stopControlsMomentum() {
    const controls = this.controls as unknown as {
      _sphericalDelta?: THREE.Spherical;
      _panOffset?: THREE.Vector3;
      _scale?: number;
    };
    controls._sphericalDelta?.set(0, 0, 0);
    controls._panOffset?.set(0, 0, 0);
    if (typeof controls._scale === 'number') controls._scale = 1;
  }

  private animateTo(view: View, duration = 650) {
    this.stopControlsMomentum();
    if (!duration) {
      this.tween = null;
      this.setView(view);
      this.requestRender();
      return;
    }
    const from = this.currentView();
    const to = { ...view, azimuth: from.azimuth + wrapAngle(view.azimuth - from.azimuth) };
    this.tween = {
      from, to, start: performance.now(), duration,
    };
    this.requestRender();
  }

  private stepTween(now: number): boolean {
    const {
      from, to, start, duration,
    } = this.tween!;
    const t = THREE.MathUtils.clamp((now - start) / duration, 0, 1);
    const e = easeInOutCubic(t);
    const fov = THREE.MathUtils.lerp(from.fov, to.fov, e);
    // Interpolate the framing size instead of the distance so FOV changes read as a dolly zoom.
    const fromSize = from.radius * Math.tan(THREE.MathUtils.degToRad(from.fov) / 2);
    const toSize = to.radius * Math.tan(THREE.MathUtils.degToRad(to.fov) / 2);
    const size = THREE.MathUtils.lerp(fromSize, toSize, e);
    this.setView({
      target: from.target.clone().lerp(to.target, e),
      radius: size / Math.tan(THREE.MathUtils.degToRad(fov) / 2),
      azimuth: THREE.MathUtils.lerp(from.azimuth, to.azimuth, e),
      elevation: THREE.MathUtils.lerp(from.elevation, to.elevation, e),
      fov,
    });
    if (t >= 1) {
      this.tween = null;
      return false;
    }
    return true;
  }

  setViewMode(mode: ViewMode, { animate = true } = {}) {
    const changed = mode !== this.viewMode;
    this.viewMode = mode;
    this.applyControlMapping();
    this.userMovedCamera = false;
    this.animateTo(mode === '2d' ? this.topView() : this.homeView(), animate ? 700 : 0);
    if (changed) {
      this.onViewModeChange?.(mode);
    }
  }

  resetView() {
    this.userMovedCamera = false;
    this.animateTo(this.viewMode === '2d' ? this.topView() : this.homeView(), 600);
  }

  viewFrom(face: CubeFace) {
    if (this.viewMode === '2d') {
      this.viewMode = '3d';
      this.applyControlMapping();
      this.onViewModeChange?.('3d');
    }
    this.userMovedCamera = true;
    this.animateTo(this.faceView(face), 600);
  }

  setPointerMode(mode: PointerMode) {
    this.pointerMode = mode;
    this.applyControlMapping();
  }

  private applyControlMapping() {
    const is2D = this.viewMode === '2d';
    const mode = is2D && this.pointerMode === 'rotate' ? 'pan' : this.pointerMode;
    const leftActions = { rotate: THREE.MOUSE.ROTATE, pan: THREE.MOUSE.PAN, zoom: THREE.MOUSE.DOLLY };
    this.controls.enableRotate = !is2D;
    this.controls.mouseButtons = {
      LEFT: leftActions[mode],
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: mode === 'pan' && !is2D ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
    };
    this.controls.touches = {
      ONE: mode === 'pan' || is2D ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.container.dataset.pointerMode = mode;
    this.container.dataset.viewMode = this.viewMode;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  requestRender() {
    if (!this.raf && !this.disposed) {
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame(now: number) {
    this.raf = 0;
    let keepGoing = false;
    if (this.tween) {
      keepGoing = this.stepTween(now) || keepGoing;
    }
    if (this.modelAnimation) {
      keepGoing = this.stepModelAnimation(now) || keepGoing;
    }
    if (this.controls.update() || this.interacting) {
      keepGoing = true;
    }
    this.renderNow();
    if (keepGoing) {
      this.requestRender();
    }
  }

  private stepModelAnimation(now: number): boolean {
    const { start, duration } = this.modelAnimation!;
    const t = THREE.MathUtils.clamp((now - start) / duration, 0, 1);
    const e = easeOutCubic(t);
    this.modelGroup.position.z = (1 - e) * 14;
    this.modelGroup.scale.setScalar(0.94 + 0.06 * e);
    if (t >= 1) {
      this.modelAnimation = null;
      this.modelGroup.position.z = 0;
      this.modelGroup.scale.setScalar(1);
      return false;
    }
    return true;
  }

  private renderNow() {
    if (this.disposed) return;
    this.updateClipPlanes();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.({
      cube: this.cubeTransform(),
      rulers: this.rulerGeometry(),
    });
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x === width && size.y === height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Render synchronously so resizing never shows an empty canvas.
    this.renderNow();
  }

  private cubeTransform(): string {
    this.camera.updateMatrixWorld();
    const rotation = new THREE.Matrix4().extractRotation(this.camera.matrixWorldInverse);
    const flip = new THREE.Matrix4().makeScale(1, -1, 1);
    const css = new THREE.Matrix4().multiplyMatrices(flip, rotation).multiply(flip);
    return `matrix3d(${css.elements.map((value) => value.toFixed(6)).join(',')})`;
  }

  private project(point: THREE.Vector3, width: number, height: number): ScreenPoint {
    const projected = this.tmpVector.copy(point).project(this.camera);
    return {
      x: ((projected.x + 1) / 2) * width,
      y: ((1 - projected.y) / 2) * height,
      visible: projected.z > -1 && projected.z < 1,
    };
  }

  /**
   * Screen-space geometry for the dimension lines: the width along the front or back edge and
   * the height along the left or right edge, each on the side closest to the camera.
   */
  private rulerGeometry(): Ruler[] {
    if (!this.hasModel || !this.bounds || this.modelAnimation) return [];
    const box = this.bounds.baseBox;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return [];
    return (['x', 'y'] as const)
      .map((axis) => this.dimensionLine(box, axis, width, height))
      .filter((ruler): ruler is Ruler => ruler !== null);
  }

  /**
   * One dimension line measuring `axis` ('x' = width, 'y' = height) of `box`.
   * It sits outside the edge that runs along `axis` and faces the camera.
   */
  private dimensionLine(box: THREE.Box3, axis: 'x' | 'y', width: number, height: number): Ruler | null {
    const size = box.getSize(new THREE.Vector3());
    const across = axis === 'x' ? 'y' : 'x';
    const center = (box.min[across] + box.max[across]) / 2;
    // the default views look from the front-left, so ties go to the front / left edge
    const near = this.camera.position[across] <= center;
    const direction = near ? -1 : 1;
    const edge = near ? box.min[across] : box.max[across];
    const span = Math.max(size.x, size.y);
    const gap = Math.max(3, span * 0.035);
    const offset = Math.max(8, span * 0.09);
    const lineAt = edge + direction * offset;

    // builds a point from a position along the measured axis and one across it
    const point = (along: number, acrossValue: number) => {
      const vector = new THREE.Vector3(0, 0, 0);
      vector[axis] = along;
      vector[across] = acrossValue;
      return vector;
    };
    const min = box.min[axis];
    const max = box.max[axis];
    const points = {
      extA0: point(min, edge + direction * gap),
      extA1: point(min, lineAt + direction * gap),
      extB0: point(max, edge + direction * gap),
      extB1: point(max, lineAt + direction * gap),
      start: point(min, lineAt),
      end: point(max, lineAt),
      label: point((min + max) / 2, lineAt + direction * Math.max(5, span * 0.06)),
    };

    const screen = {} as Record<keyof typeof points, ScreenPoint>;
    let visible = true;
    (Object.keys(points) as (keyof typeof points)[]).forEach((key) => {
      screen[key] = this.project(points[key], width, height);
      visible = visible && screen[key].visible;
    });
    if (!visible) return null;

    const dx = screen.end.x - screen.start.x;
    const dy = screen.end.y - screen.start.y;
    if (Math.hypot(dx, dy) < 48) return null;

    let angle = THREE.MathUtils.radToDeg(Math.atan2(dy, dx));
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;

    return {
      ...screen,
      axis,
      angle,
      value: size[axis],
    };
  }

  /* ------------------------------------------------------------------ */
  /* Image export                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Renders a transparent orthographic image of the model without disturbing the interactive view.
   * - `fromBelow` looks at the underside, e.g. for designs printed face down
   * - `maxSide` is the size of the longer side in pixels; `type` / `quality` select the encoding
   * Preview-only props are hidden. Resolves with the encoded image.
   */
  renderPNG({
    maxSide = PNG_MAX_SIDE, fromBelow = false, type = 'image/png', quality,
  }: { maxSide?: number; fromBelow?: boolean; type?: string; quality?: number } = {}): Promise<Blob> {
    if (!this.hasModel || !this.bounds) {
      return Promise.reject(new Error('No model to render'));
    }
    const { box } = this.bounds;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const padding = 1.03;
    const halfWidth = (size.x * padding) / 2;
    const halfHeight = (size.y * padding) / 2;
    const aspect = halfWidth / halfHeight;
    const pixelWidth = aspect >= 1 ? maxSide : Math.round(maxSide * aspect);
    const pixelHeight = aspect >= 1 ? Math.round(maxSide / aspect) : maxSide;

    const camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 4000);
    camera.up.set(0, 1, 0);
    camera.position.set(center.x, center.y, fromBelow ? box.min.z - 1000 : box.max.z + 1000);
    camera.lookAt(center.x, center.y, center.z);

    const previousSize = this.renderer.getSize(new THREE.Vector2());
    const previousPixelRatio = this.renderer.getPixelRatio();
    this.grid.visible = false;
    this.shadowPlane.visible = false;
    this.propGroup.visible = false;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(pixelWidth, pixelHeight, false);
    this.renderer.render(this.scene, camera);

    const output = document.createElement('canvas');
    output.width = pixelWidth;
    output.height = pixelHeight;
    // trimCanvas reads the pixels back, so ask for a CPU-backed context
    output.getContext('2d', { willReadFrequently: true })!.drawImage(this.renderer.domElement, 0, 0);

    this.grid.visible = true;
    this.shadowPlane.visible = true;
    this.propGroup.visible = true;
    this.renderer.setPixelRatio(previousPixelRatio);
    this.renderer.setSize(previousSize.x, previousSize.y, false);
    this.renderNow();

    return new Promise((resolve, reject) => {
      trimCanvas(output).toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), type, quality);
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.controls.dispose();
    this.clearModel();
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.shadowPlane.geometry.dispose();
    this.shadowPlane.material.dispose();
    this.environmentMap.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
