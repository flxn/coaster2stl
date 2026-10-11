<template>
  <div class="viewport" :class="{ 'has-model': hasModel, 'is-generating': isGenerating }">
    <div ref="canvasHost" class="viewport__canvas" role="img" :aria-label="t('preview')"></div>

    <!-- dimension rulers (width and height), positioned every frame from the 3D bounds -->
    <svg class="viewport__ruler" aria-hidden="true">
      <g v-for="(axis, index) in RULER_AXES" :key="axis" :ref="(el) => { rulerGroups[index] = el as SVGGElement }" style="display: none">
        <line class="ruler-ext" />
        <line class="ruler-ext" />
        <line class="ruler-line" />
        <polygon class="ruler-arrow" />
        <polygon class="ruler-arrow" />
      </g>
    </svg>
    <div
      v-for="(axis, index) in RULER_AXES"
      :key="'label-' + axis"
      :ref="(el) => { rulerLabels[index] = el as HTMLDivElement }"
      class="ruler-label"
      style="display: none"
    ></div>

    <!-- toolbar -->
    <div class="viewport__toolbar" role="toolbar" :aria-label="t('viewControls')">
      <UiSegmented
        :model-value="viewMode"
        variant="accent"
        :options="viewModeOptions"
        :aria-label="t('viewMode')"
        tip-pos="bottom"
        @update:model-value="setViewMode"
      />
      <span class="toolbar-divider toolbar-divider--tools" aria-hidden="true"></span>
      <button
        v-for="tool in tools"
        :key="tool.id"
        type="button"
        class="tool-button tool-button--pointer"
        :class="{ 'is-active': effectivePointerMode === tool.id }"
        :disabled="tool.id === 'rotate' && viewMode === '2d'"
        :aria-pressed="effectivePointerMode === tool.id ? 'true' : 'false'"
        :data-tip="tool.tip"
        data-tip-pos="bottom"
        @click="setPointerMode(tool.id)"
      >
        <UiIcon :name="tool.icon" />
        <span class="tool-button__label">{{ tool.label }}</span>
      </button>
      <span class="toolbar-divider" aria-hidden="true"></span>
      <button type="button" class="tool-button" :data-tip="t('resetViewTip')" data-tip-pos="bottom" @click="stage?.resetView()">
        <UiIcon name="rotate-ccw" />
        <span class="tool-button__label">{{ t('resetView') }}</span>
      </button>
      <span class="toolbar-divider" aria-hidden="true"></span>
      <button
        type="button"
        class="tool-button tool-button--live"
        :class="{ 'is-on': liveUpdate }"
        :aria-pressed="liveUpdate ? 'true' : 'false'"
        :data-tip="t('liveUpdateTip')"
        data-tip-pos="bottom"
        @click="emit('update:liveUpdate', !liveUpdate)"
      >
        <UiIcon name="zap" />
        <span class="tool-button__label">{{ t('liveUpdate') }}</span>
      </button>
      <template v-if="$slots.toolbar">
        <span class="toolbar-divider" aria-hidden="true"></span>
        <slot name="toolbar" />
      </template>
    </div>

    <!-- orientation cube -->
    <div class="view-cube" :title="t('viewCubeTip')">
      <div ref="cube" class="view-cube__cube">
        <button
          v-for="face in cubeFaces"
          :key="face.id"
          type="button"
          class="view-cube__face"
          :class="`view-cube__face--${face.css}`"
          :aria-label="face.label"
          :title="face.label"
          @click="stage?.viewFrom(face.id)"
        >{{ face.text }}</button>
      </div>
    </div>

    <!-- status -->
    <Transition name="rise">
      <div v-if="isGenerating && hasModel" key="generating" class="viewport__status">
        <span class="chip chip--accent">
          <UiIcon name="loader" class="spin" />
          {{ t('updatingModel') }}
        </span>
      </div>
      <div v-else-if="isStale && !liveUpdate" key="stale" class="viewport__status">
        <button type="button" class="chip chip--accent chip--action" @click="emit('generate')">
          <span class="stale-dot" aria-hidden="true"></span>
          {{ t('settingsChanged') }}
          <strong>{{ t('updateModel') }}</strong>
          <span class="kbd">{{ modifierKey }} ↵</span>
        </button>
      </div>
    </Transition>

    <!-- empty / first generation state -->
    <Transition name="empty">
      <div v-if="!hasModel" class="viewport__empty">
        <div class="empty-state" :class="{ 'is-busy': isGenerating }">
          <div class="empty-state__icon">
            <UiIcon v-if="isGenerating" name="loader" class="spin" />
            <UiIcon v-else name="box" />
          </div>
          <p class="empty-state__title">{{ isGenerating ? t('isGenerating') : t('emptyTitle') }}</p>
          <p v-if="!isGenerating" class="empty-state__hint">
            {{ emptyHint }}
            <span class="empty-state__keys"><span class="kbd">{{ modifierKey }}</span><span class="kbd">↵</span></span>
          </p>
        </div>
      </div>
    </Transition>

    <slot name="overlay" />

    <!-- bottom right: dimensions and warnings -->
    <div class="viewport__meta">
      <TransitionGroup name="rise" tag="div" class="viewport__warnings">
        <span v-for="warning in warnings" :key="warning.code" class="chip chip--warning" :title="warning.help" role="status">
          <UiIcon name="alert" />
          {{ warning.label }}
        </span>
      </TransitionGroup>
      <Transition name="rise">
        <span v-if="dimensionsLabel && hasModel" class="chip" :title="t('modelDimensions')">
          <UiIcon name="ruler" />
          {{ dimensionsLabel }}
        </span>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import type { DescribedWarning } from '../composables/useModelWarnings';
import PreviewStage, {
  type CubeFace, type FrameInfo, type PointerMode, type Ruler, type Theme, type ViewMode,
} from '../preview/PreviewStage';
import type { Object3D } from 'three';
import type { ModelPart } from '../types';
import { modifierKey } from '../utils/platform';
import UiIcon from './ui/UiIcon.vue';
import UiSegmented from './ui/UiSegmented.vue';

const RULER_AXES = ['x', 'y'] as const;

const props = withDefaults(defineProps<{
  theme: Theme;
  hasModel: boolean;
  isGenerating: boolean;
  isStale: boolean;
  liveUpdate: boolean;
  warnings?: DescribedWarning[];
  emptyHint?: string;
}>(), {
  warnings: () => [],
  emptyHint: '',
});

const emit = defineEmits<{
  'update:liveUpdate': [value: boolean];
  generate: [];
}>();

const { t } = useI18n();

const canvasHost = useTemplateRef<HTMLDivElement>('canvasHost');
const cube = useTemplateRef<HTMLDivElement>('cube');
const rulerGroups: SVGGElement[] = [];
const rulerLabels: HTMLDivElement[] = [];
const stage = shallowRef<PreviewStage | null>(null);
const viewMode = ref<ViewMode>('3d');
const pointerMode = ref<PointerMode>('rotate');
const dimensions = ref<{ x: number; y: number; z: number } | null>(null);

const formatMillimeters = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const effectivePointerMode = computed(() => (viewMode.value === '2d' && pointerMode.value === 'rotate' ? 'pan' : pointerMode.value));

const viewModeOptions = computed(() => [
  { value: '3d' as const, label: '3D', tip: t('view3dTip') },
  { value: '2d' as const, label: '2D', tip: t('view2dTip') },
]);

const tools = computed(() => [
  { id: 'rotate' as const, icon: 'move', label: t('toolRotate'), tip: t('toolRotateTip') },
  { id: 'pan' as const, icon: 'hand', label: t('toolPan'), tip: t('toolPanTip') },
  { id: 'zoom' as const, icon: 'zoom-in', label: t('toolZoom'), tip: t('toolZoomTip') },
]);

const cubeFaces = computed((): { id: CubeFace; css: string; text: string; label: string }[] => [
  { id: '+z', css: 'pz', text: 'Z', label: t('viewTop') },
  { id: '-z', css: 'nz', text: 'Z', label: t('viewBottom') },
  { id: '+x', css: 'px', text: 'X', label: t('viewRight') },
  { id: '-x', css: 'nx', text: 'X', label: t('viewLeft') },
  { id: '+y', css: 'py', text: 'Y', label: t('viewBack') },
  { id: '-y', css: 'ny', text: 'Y', label: t('viewFront') },
]);

const dimensionsLabel = computed(() => {
  if (!dimensions.value) {
    return '';
  }
  const { x, y, z } = dimensions.value;
  return `${formatMillimeters(x)} × ${formatMillimeters(y)} × ${formatMillimeters(z)} mm`;
});

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode;
  stage.value?.setViewMode(mode);
};

const setPointerMode = (mode: PointerMode) => {
  pointerMode.value = mode;
  stage.value?.setPointerMode(mode);
};

const updateRuler = (group: SVGGElement | undefined, label: HTMLDivElement | undefined, ruler: Ruler | undefined) => {
  if (!group || !label) {
    return;
  }
  if (!ruler) {
    group.style.display = 'none';
    label.style.display = 'none';
    return;
  }
  group.style.display = '';
  label.style.display = '';
  const [extA, extB, dimLine] = Array.from(group.querySelectorAll('line'));
  const [arrowA, arrowB] = Array.from(group.querySelectorAll('polygon'));
  const setLine = (el: SVGLineElement, a: { x: number; y: number }, b: { x: number; y: number }) => {
    el.setAttribute('x1', String(a.x));
    el.setAttribute('y1', String(a.y));
    el.setAttribute('x2', String(b.x));
    el.setAttribute('y2', String(b.y));
  };
  setLine(extA, ruler.extA0, ruler.extA1);
  setLine(extB, ruler.extB0, ruler.extB1);
  setLine(dimLine, ruler.start, ruler.end);

  // arrow heads pointing outwards at both ends
  const dx = ruler.end.x - ruler.start.x;
  const dy = ruler.end.y - ruler.start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const arrow = (tip: { x: number; y: number }, direction: number) => {
    const size = 9;
    const spread = 4;
    const bx = tip.x - ux * size * direction;
    const by = tip.y - uy * size * direction;
    return `${tip.x},${tip.y} ${bx - uy * spread},${by + ux * spread} ${bx + uy * spread},${by - ux * spread}`;
  };
  arrowA.setAttribute('points', arrow(ruler.start, -1));
  arrowB.setAttribute('points', arrow(ruler.end, 1));

  const text = `${formatMillimeters(ruler.value)} mm`;
  if (label.textContent !== text) {
    label.textContent = text;
  }
  label.style.transform = `translate(${ruler.label.x}px, ${ruler.label.y}px) translate(-50%, -50%) rotate(${ruler.angle}deg)`;
};

// runs every rendered frame, so it writes to the DOM directly instead of going through Vue
const onFrame = ({ cube: transform, rulers }: FrameInfo) => {
  if (cube.value) {
    cube.value.style.transform = transform;
  }
  RULER_AXES.forEach((axis, index) => {
    updateRuler(rulerGroups[index], rulerLabels[index], rulers.find((item) => item.axis === axis));
  });
};

watch(() => props.theme, (theme) => stage.value?.setTheme(theme));

onMounted(() => {
  stage.value = new PreviewStage(canvasHost.value!, {
    theme: props.theme,
    onFrame,
    onViewModeChange: (mode) => {
      viewMode.value = mode;
    },
  });
  if (import.meta.env.DEV) {
    // handy for debugging the preview from the browser console
    (window as unknown as { previewStage: PreviewStage }).previewStage = stage.value;
  }
});

onBeforeUnmount(() => {
  stage.value?.dispose();
  stage.value = null;
});

defineExpose({
  /** shows new model parts; `fit` frames the camera, `animate` plays the drop-in animation */
  showModel(parts: ModelPart[], options: { fit?: boolean; animate?: boolean } = {}) {
    stage.value?.setModel(parts, options);
    const size = stage.value?.getModelSize();
    dimensions.value = size ? { x: size.x, y: size.y, z: size.z } : null;
  },
  clearModel() {
    stage.value?.clearModel();
    dimensions.value = null;
  },
  renderPNG(options?: Parameters<PreviewStage['renderPNG']>[0]): Promise<Blob> {
    return stage.value ? stage.value.renderPNG(options) : Promise.reject(new Error('Preview not ready'));
  },
  /** preview-only objects such as a mug on the coaster */
  setProps(objects: Object3D[]) {
    stage.value?.setProps(objects);
  },
});
</script>

<style>
.viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--viewport-border);
  border-radius: var(--radius-lg);
  background: var(--viewport-bg);
  overflow: hidden;
  isolation: isolate;
}

.viewport__canvas {
  position: absolute;
  inset: 0;
}

.preview-canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
  touch-action: none;
}

.viewport__canvas[data-pointer-mode="rotate"] .preview-canvas {
  cursor: grab;
}

.viewport__canvas[data-pointer-mode="pan"] .preview-canvas {
  cursor: move;
}

.viewport__canvas[data-pointer-mode="zoom"] .preview-canvas {
  cursor: ns-resize;
}

.viewport__canvas.is-dragging[data-pointer-mode="rotate"] .preview-canvas {
  cursor: grabbing;
}

/* ---------- toolbar ---------- */
.viewport__toolbar {
  position: absolute;
  z-index: 3;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: calc(100% - 130px);
  padding: 5px;
  border: 1px solid var(--viewport-chrome-border);
  border-radius: var(--radius-md);
  background: var(--viewport-chrome);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.viewport__toolbar .segmented {
  padding: 2px;
  border: 0;
  background: transparent;
}

.viewport__toolbar .segmented__item {
  min-width: 44px;
  height: 32px;
  font-size: 13.5px;
  font-weight: 600;
}

.toolbar-divider {
  flex-shrink: 0;
  width: 1px;
  height: 22px;
  margin: 0 6px;
  background: var(--border-strong);
}

.tool-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color var(--duration) ease, color var(--duration) ease, transform var(--duration-fast) ease;
}

.tool-button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text);
}

.tool-button:active:not(:disabled) {
  transform: scale(0.96);
}

.tool-button.is-active {
  background: var(--surface-active);
  color: var(--text);
}

.tool-button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.tool-button .svg-icon {
  width: 18px;
  height: 18px;
}

.tool-button--live.is-on {
  color: var(--accent-text);
}

.tool-button--live.is-on .svg-icon {
  fill: currentColor;
  fill-opacity: 0.25;
}

@container stage (max-width: 860px) {
  .tool-button__label {
    display: none;
  }

  .tool-button {
    padding: 0 9px;
  }
}

/* touch screens use gestures (one finger rotates, two fingers pan and zoom) */
@media (max-width: 600px) {
  .tool-button--pointer,
  .toolbar-divider--tools {
    display: none;
  }

  /* the toolbar gets the full width, the cube moves below it */
  .viewport__toolbar {
    top: 10px;
    left: 10px;
    max-width: calc(100% - 20px);
  }

  .viewport__toolbar .segmented__item {
    min-width: 38px;
  }

  .tool-button {
    padding: 0 8px;
  }

  .toolbar-divider {
    margin: 0 3px;
  }

  .view-cube {
    top: 58px;
    right: 6px;
    transform: scale(0.8);
  }
}

/* ---------- view cube ---------- */
.view-cube {
  position: absolute;
  z-index: 3;
  top: 18px;
  right: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  perspective: 320px;
}

.view-cube__cube {
  position: relative;
  width: 50px;
  height: 50px;
  transform-style: preserve-3d;
}

.view-cube__face {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--cube-edge);
  border-radius: 3px;
  background: var(--cube-face);
  color: var(--cube-text);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition: background-color var(--duration) ease, color var(--duration) ease;
}

.view-cube__face:hover,
.view-cube__face:focus-visible {
  outline: none;
  background: var(--accent);
  color: #fff;
}

.view-cube__face--pz {
  background: var(--cube-face-top);
  transform: translateZ(25px);
}

.view-cube__face--nz {
  background: var(--cube-face-shade);
  transform: rotateY(180deg) translateZ(25px);
}

.view-cube__face--px {
  background: var(--cube-face-side);
  transform: rotateY(90deg) translateZ(25px) rotateZ(-90deg);
}

.view-cube__face--nx {
  background: var(--cube-face-side);
  transform: rotateY(-90deg) translateZ(25px) rotateZ(90deg);
}

.view-cube__face--py {
  transform: rotateX(90deg) translateZ(25px) rotateZ(180deg);
}

.view-cube__face--ny {
  transform: rotateX(-90deg) translateZ(25px);
}

/* ---------- ruler ---------- */
.viewport__ruler {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.ruler-line,
.ruler-ext {
  stroke: var(--ruler);
  stroke-linecap: round;
}

.ruler-line {
  stroke-width: 2;
}

.ruler-ext {
  stroke-width: 1.25;
  opacity: 0.75;
}

.ruler-arrow {
  fill: var(--ruler);
}

.ruler-label {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ruler-label-bg);
  color: var(--ruler);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.01em;
  white-space: nowrap;
  pointer-events: none;
  will-change: transform;
}

/* ---------- status + overlays ---------- */
.viewport__status {
  position: absolute;
  z-index: 4;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
}

.chip--action {
  height: 34px;
  gap: 8px;
  padding: 0 8px 0 12px;
  cursor: pointer;
  transition: transform var(--duration-fast) ease, box-shadow var(--duration) ease;
}

.chip--action:hover {
  box-shadow: var(--shadow-md);
}

.chip--action:active {
  transform: scale(0.97);
}

.chip--action strong {
  color: var(--text);
  font-weight: 600;
}

.stale-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.stale-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--accent);
  animation: ui-ping 1.6s var(--ease-out) infinite;
}

.viewport__empty {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  pointer-events: none;
}

.empty-enter-active {
  transition: opacity 260ms ease 120ms;
}

.empty-leave-active {
  transition: opacity 120ms ease, transform 160ms ease;
}

.empty-enter-from,
.empty-leave-to {
  opacity: 0;
}

.empty-leave-to {
  transform: scale(0.96);
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  max-width: 440px;
  text-align: center;
}

.empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 6px;
  border: 1px solid var(--viewport-chrome-border);
  border-radius: 20px;
  background: var(--viewport-chrome);
  color: var(--accent-text);
  box-shadow: var(--shadow-md);
}

.empty-state__icon .svg-icon {
  width: 28px;
  height: 28px;
}

.empty-state:not(.is-busy) .empty-state__icon {
  animation: empty-float 4s ease-in-out infinite;
}

@keyframes empty-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

.empty-state__title {
  margin: 0;
  color: var(--text);
  font-size: 17px;
  font-weight: 600;
}

.empty-state__hint {
  margin: 0;
  color: var(--text-3);
  font-size: 14px;
  line-height: 1.5;
}

.empty-state__keys {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  vertical-align: 1px;
}

.viewport__meta {
  position: absolute;
  z-index: 3;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.viewport__warnings {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.viewport__warnings:empty {
  display: none;
}

.viewport__warnings .chip {
  cursor: help;
}
</style>
