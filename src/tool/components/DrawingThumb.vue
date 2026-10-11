<template>
  <svg class="drawing-thumb" viewBox="-1.05 -1.05 2.1 2.1" aria-hidden="true">
    <circle r="1" :fill="base" class="drawing-thumb__disc" />
    <polyline
      v-for="(stroke, index) in strokes"
      :key="index"
      :points="stroke.points"
      fill="none"
      :stroke="stroke.erase ? base : color"
      :stroke-width="stroke.width"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { expandStrokes } from '../drawing';
import type { ToolOptions } from '../options';

const props = defineProps<{ drawing: ToolOptions['drawing']; color: string; base: string }>();

const strokes = computed(() => expandStrokes(props.drawing.strokes, props.drawing.symmetry, props.drawing.segments).map((stroke) => {
  const points: string[] = [];
  for (let i = 0; i + 1 < stroke.points.length; i += 2) {
    points.push(`${stroke.points[i].toFixed(3)},${(-stroke.points[i + 1]).toFixed(3)}`);
  }
  // a single point is drawn as a dot
  if (points.length === 1) points.push(points[0]);
  return { points: points.join(' '), width: stroke.width, erase: stroke.erase };
}));
</script>

<style scoped>
.drawing-thumb {
  display: block;
  width: 100%;
  height: 100%;
}

.drawing-thumb__disc {
  stroke: var(--border-strong);
  stroke-width: 0.02;
}
</style>
