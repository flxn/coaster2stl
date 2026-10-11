<template>
  <UiModal :open="open" :title="t('tool.sketch.title')" :subtitle="t('tool.sketch.subtitle')" icon="brush" size="lg" @close="emit('close')">
    <div class="sketchpad">
      <div ref="stage" class="sketchpad__stage">
        <canvas
          ref="canvas"
          class="sketchpad__canvas"
          :class="{ 'is-erasing': tool === 'erase' }"
          :aria-label="t('tool.sketch.canvas')"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        ></canvas>
        <p v-if="!drawing.strokes.length && !current" class="sketchpad__hint">{{ t('tool.sketch.hint') }}</p>
      </div>

      <div class="sketchpad__tools">
        <UiSegmented v-model="tool" block :options="toolOptions" :aria-label="t('tool.sketch.tool')" />
        <UiSlider
          v-model="brush"
          :label="t('tool.sketch.brush')"
          :min="0.8"
          :max="10"
          :step="0.2"
          unit=" mm"
          :reset-to="2.4"
          :reset-label="t('tool.sketch.brushReset')"
        />

        <div class="sketchpad__group">
          <span class="group-title">{{ t('tool.sketch.symmetry') }}</span>
          <div class="symmetry-grid" role="radiogroup" :aria-label="t('tool.sketch.symmetry')">
            <button
              v-for="mode in SYMMETRIES"
              :key="mode"
              type="button"
              class="symmetry-option"
              :class="{ 'is-active': drawing.symmetry === mode }"
              role="radio"
              :aria-checked="drawing.symmetry === mode ? 'true' : 'false'"
              @click="drawing.symmetry = mode"
            >
              <svg viewBox="-10 -10 20 20" aria-hidden="true">
                <circle r="9" class="symmetry-option__disc" />
                <path
                  v-for="(line, index) in symmetryPreview(mode)"
                  :key="index"
                  :d="line"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
              <span>{{ t(`tool.sketch.symmetries.${mode}`) }}</span>
            </button>
          </div>
          <UiSlider
            v-if="drawing.symmetry === 'radial' || drawing.symmetry === 'kaleidoscope'"
            v-model="drawing.segments"
            :label="t('tool.sketch.segments')"
            :min="2"
            :max="16"
            :step="1"
            :reset-to="8"
            :reset-label="t('tool.sketch.segmentsReset')"
          />
        </div>

        <div class="button-row">
          <button type="button" class="btn btn--sm" :disabled="!drawing.strokes.length" :data-tip="`${t('tool.sketch.undo')} · ${modifierKey} Z`" @click="undo">
            <UiIcon name="undo" /><span>{{ t('tool.sketch.undo') }}</span>
          </button>
          <button type="button" class="btn btn--sm" :disabled="!redoStack.length" :data-tip="`${t('tool.sketch.redo')} · ${modifierKey} ⇧ Z`" @click="redo">
            <UiIcon name="redo" /><span>{{ t('tool.sketch.redo') }}</span>
          </button>
          <button type="button" class="btn btn--sm btn--danger" :disabled="!drawing.strokes.length" @click="clear">
            <UiIcon name="trash" /><span>{{ t('tool.sketch.clear') }}</span>
          </button>
        </div>
        <p class="field-hint">{{ t('tool.sketch.tips') }}</p>
      </div>
    </div>
    <template #footer>
      <span class="field-hint sketchpad__count">{{ t('tool.sketch.count', { count: drawing.strokes.length }, drawing.strokes.length) }}</span>
      <span class="modal__footer-spacer"></span>
      <button type="button" class="btn btn--primary" @click="emit('close')">
        <UiIcon name="check" /><span>{{ t('tool.sketch.done') }}</span>
      </button>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
/**
 * Freehand drawing on the coaster. Strokes are stored relative to the design radius and mirrored
 * or rotated by the symmetry mode, exactly like the generator does it (see ../drawing.ts).
 * Every finished stroke updates the settings, so the 3D preview follows along.
 */
import {
  computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiModal from '@/core/components/ui/UiModal.vue';
import UiSegmented from '@/core/components/ui/UiSegmented.vue';
import UiSlider from '@/core/components/ui/UiSlider.vue';
import { modifierKey } from '@/core/utils/platform';
import { expandStrokes, symmetryTransforms } from '../drawing';
import {
  MAX_STROKES, type DrawingStroke, type Symmetry, type ToolOptions, type UploadedArtwork,
} from '../options';

const SYMMETRIES: Symmetry[] = ['none', 'mirror', 'radial', 'kaleidoscope'];
/** the design circle uses this share of the canvas */
const FILL = 0.92;

const props = defineProps<{
  open: boolean;
  /** radius of the design area in mm (for the brush size) */
  designRadius: number;
  colors: { base: string; design: string };
  /** the artwork, drawn faintly as a guide */
  guide: { path?: string; upload?: UploadedArtwork | null; scale: number; rotation: number; offsetX: number; offsetY: number } | null;
}>();
const drawing = defineModel<ToolOptions['drawing']>({ required: true });
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const stage = useTemplateRef<HTMLDivElement>('stage');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const tool = ref<'draw' | 'erase'>('draw');
const brush = ref(2.4);
const redoStack = shallowRef<DrawingStroke[][]>([]);
const current = shallowRef<{ points: number[]; pointerId: number } | null>(null);
let layer: HTMLCanvasElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let size = 0;

const toolOptions = computed(() => [
  { value: 'draw' as const, label: t('tool.sketch.pen'), icon: 'pencil' },
  { value: 'erase' as const, label: t('tool.sketch.eraser'), icon: 'eraser' },
]);

const symmetryPreview = (mode: Symmetry) => symmetryTransforms(mode, 6).map((transform) => {
  const points = [[1.5, 2], [4.5, 4.8], [3.2, 7.5]].map(([x, y]) => transform(x, y));
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join(' L')}`;
});

/* ---------- rendering ---------- */

const radiusPx = () => (size / 2) * FILL;
const toCanvas = (x: number, y: number): [number, number] => [size / 2 + x * radiusPx(), size / 2 - y * radiusPx()];
const fromEvent = (event: PointerEvent): [number, number] => {
  const rect = canvas.value!.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * size;
  const y = ((event.clientY - rect.top) / rect.height) * size;
  return [(x - size / 2) / radiusPx(), (size / 2 - y) / radiusPx()];
};

const drawGuide = (ctx: CanvasRenderingContext2D) => {
  const { guide } = props;
  if (!guide || (!guide.path && !guide.upload)) return;
  const sizeMm = (guide.scale / 100) * props.designRadius * 2;
  const pxPerMm = radiusPx() / props.designRadius;
  ctx.save();
  ctx.translate(...toCanvas(guide.offsetX / props.designRadius, guide.offsetY / props.designRadius));
  ctx.rotate((guide.rotation * Math.PI) / 180);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = props.colors.design;
  if (guide.path) {
    const scale = (sizeMm * pxPerMm) / 24;
    ctx.scale(scale, scale);
    ctx.translate(-12, -12);
    ctx.fill(new Path2D(guide.path));
  } else if (guide.upload) {
    const art = guide.upload;
    const scale = (sizeMm * pxPerMm) / Math.max(art.width, art.height);
    ctx.scale(scale, scale);
    ctx.translate(-art.width / 2, -art.height / 2);
    const path = new Path2D(art.polygons.map((polygon) => [polygon.outer, ...polygon.holes]
      .map((ring) => `M${ring.join(' ')}Z`).join('')).join(''));
    ctx.fill(path, 'evenodd');
  }
  ctx.restore();
};

const drawStrokes = (ctx: CanvasRenderingContext2D, strokes: DrawingStroke[]) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  expandStrokes(strokes, drawing.value.symmetry, drawing.value.segments).forEach((stroke) => {
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = props.colors.design;
    ctx.fillStyle = props.colors.design;
    ctx.lineWidth = stroke.width * radiusPx();
    if (stroke.points.length === 2) {
      ctx.beginPath();
      ctx.arc(...toCanvas(stroke.points[0], stroke.points[1]), (stroke.width * radiusPx()) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    for (let i = 0; i + 1 < stroke.points.length; i += 2) {
      const [x, y] = toCanvas(stroke.points[i], stroke.points[i + 1]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  ctx.globalCompositeOperation = 'source-over';
};

const render = () => {
  const element = canvas.value;
  if (!element || !size) return;
  const ctx = element.getContext('2d')!;
  const dpr = element.width / size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  // the coaster
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radiusPx(), 0, Math.PI * 2);
  ctx.fillStyle = props.colors.base;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.stroke();

  // symmetry guides
  const transforms = symmetryTransforms(drawing.value.symmetry, drawing.value.segments);
  if (transforms.length > 1) {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(232, 87, 47, 0.45)';
    ctx.lineWidth = 1;
    const axes = drawing.value.symmetry === 'mirror' ? 1 : Math.round(drawing.value.segments) * (drawing.value.symmetry === 'kaleidoscope' ? 2 : 1);
    for (let i = 0; i < axes; i += 1) {
      const angle = drawing.value.symmetry === 'mirror' ? Math.PI / 2 : Math.PI / 2 + (i * Math.PI * 2) / axes;
      ctx.beginPath();
      ctx.moveTo(size / 2, size / 2);
      ctx.lineTo(...toCanvas(Math.cos(angle), Math.sin(angle)));
      if (drawing.value.symmetry === 'mirror') ctx.lineTo(...toCanvas(0, -1));
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGuide(ctx);

  // strokes on their own layer, so the eraser only removes ink
  if (!layer) layer = document.createElement('canvas');
  layer.width = element.width;
  layer.height = element.height;
  const layerCtx = layer.getContext('2d')!;
  layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const strokes = current.value
    ? [...drawing.value.strokes, { points: current.value.points, width: brushWidth(), erase: tool.value === 'erase' }]
    : drawing.value.strokes;
  drawStrokes(layerCtx, strokes);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.arc(element.width / 2, element.height / 2, radiusPx() * dpr, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
};

let frame = 0;
const requestRender = () => {
  if (!frame) {
    frame = requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  }
};

const resize = () => {
  const element = canvas.value;
  const host = stage.value;
  if (!element || !host) return;
  size = Math.min(host.clientWidth, 560);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.width = Math.round(size * dpr);
  element.height = Math.round(size * dpr);
  render();
};

/* ---------- drawing ---------- */

const brushWidth = () => brush.value / Math.max(props.designRadius, 1);
const round = (value: number) => Math.round(value * 10000) / 10000;

/** Douglas–Peucker on a flat point list, so long strokes stay small. */
const simplify = (points: number[], tolerance: number): number[] => {
  const count = points.length / 2;
  if (count < 3) return points;
  const keep = new Array<boolean>(count).fill(false);
  keep[0] = true;
  keep[count - 1] = true;
  const stack: [number, number][] = [[0, count - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const ax = points[start * 2];
    const ay = points[start * 2 + 1];
    const dx = points[end * 2] - ax;
    const dy = points[end * 2 + 1] - ay;
    const length = Math.hypot(dx, dy) || 1e-9;
    let max = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = Math.abs(dx * (points[i * 2 + 1] - ay) - dy * (points[i * 2] - ax)) / length;
      if (distance > max) {
        max = distance;
        index = i;
      }
    }
    if (max > tolerance && index > 0) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[Math.floor(i / 2)]);
};

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0 || current.value) return;
  if (drawing.value.strokes.length >= MAX_STROKES) {
    return;
  }
  canvas.value?.setPointerCapture(event.pointerId);
  current.value = { points: fromEvent(event), pointerId: event.pointerId };
  requestRender();
};

const onPointerMove = (event: PointerEvent) => {
  const stroke = current.value;
  if (!stroke || event.pointerId !== stroke.pointerId) return;
  const events = event.getCoalescedEvents?.() ?? [event];
  events.forEach((item) => {
    const [x, y] = fromEvent(item);
    const last = stroke.points.length - 2;
    if (Math.hypot(x - stroke.points[last], y - stroke.points[last + 1]) > 0.004) {
      stroke.points.push(x, y);
    }
  });
  requestRender();
};

const commit = (strokes: DrawingStroke[]) => {
  drawing.value.strokes = strokes;
  requestRender();
};

const onPointerUp = (event: PointerEvent) => {
  const stroke = current.value;
  if (!stroke || event.pointerId !== stroke.pointerId) return;
  current.value = null;
  const points = simplify(stroke.points, 0.0015).map(round);
  redoStack.value = [];
  commit([...drawing.value.strokes, { points, width: round(brushWidth()), erase: tool.value === 'erase' }]);
};

const undo = () => {
  const strokes = drawing.value.strokes;
  if (!strokes.length) return;
  redoStack.value = [...redoStack.value, strokes.slice(-1)];
  commit(strokes.slice(0, -1));
};

const redo = () => {
  const next = redoStack.value[redoStack.value.length - 1];
  if (!next) return;
  redoStack.value = redoStack.value.slice(0, -1);
  commit([...drawing.value.strokes, ...next]);
};

const clear = () => {
  if (!drawing.value.strokes.length) return;
  redoStack.value = [...redoStack.value, drawing.value.strokes];
  commit([]);
};

const onKeydown = (event: KeyboardEvent) => {
  if (!props.open || (event.target as HTMLElement)?.tagName === 'INPUT') return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  } else if (event.key === 'e') {
    tool.value = 'erase';
  } else if (event.key === 'b' || event.key === 'p') {
    tool.value = 'draw';
  } else if (event.key === '[') {
    brush.value = Math.max(0.8, Math.round((brush.value - 0.4) * 10) / 10);
  } else if (event.key === ']') {
    brush.value = Math.min(10, Math.round((brush.value + 0.4) * 10) / 10);
  }
};

watch(() => props.open, (open) => {
  if (open) {
    window.addEventListener('keydown', onKeydown);
    nextTick(() => {
      resize();
      resizeObserver = new ResizeObserver(resize);
      if (stage.value) resizeObserver.observe(stage.value);
    });
  } else {
    window.removeEventListener('keydown', onKeydown);
    resizeObserver?.disconnect();
    resizeObserver = null;
  }
});

watch(() => [drawing.value.symmetry, drawing.value.segments, props.colors.base, props.colors.design, props.guide], requestRender, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  resizeObserver?.disconnect();
  cancelAnimationFrame(frame);
});
</script>

<style scoped>
.sketchpad {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 20px;
  align-items: start;
}

.sketchpad__stage {
  position: relative;
  display: flex;
  justify-content: center;
  min-width: 0;
  padding: 8px;
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 0) 0 0 / 16px 16px,
    var(--surface-inset);
}

.sketchpad__canvas {
  display: block;
  max-width: 100%;
  cursor: crosshair;
  touch-action: none;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.18));
}

.sketchpad__canvas.is-erasing {
  cursor: cell;
}

.sketchpad__hint {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: 0;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--viewport-chrome);
  color: var(--text-2);
  font-size: 13px;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.sketchpad__tools {
  display: grid;
  gap: 14px;
}

.sketchpad__group {
  display: grid;
  gap: 8px;
}

.symmetry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.symmetry-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-2);
  font-size: 12.5px;
  text-align: left;
}

.symmetry-option svg {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  color: var(--text-3);
}

.symmetry-option__disc {
  fill: var(--surface-inset);
  stroke: var(--border-strong);
}

.symmetry-option.is-active {
  border-color: var(--accent-soft-border);
  background: var(--accent-soft);
  color: var(--text);
}

.symmetry-option.is-active svg {
  color: var(--accent);
}

.sketchpad__count {
  margin: 0;
}

@media (max-width: 760px) {
  .sketchpad {
    grid-template-columns: 1fr;
  }
}
</style>
