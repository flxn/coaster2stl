<template>
  <div class="shape-picker" role="radiogroup" :aria-label="label">
    <button
      v-for="shape in COASTER_SHAPES"
      :key="shape"
      type="button"
      class="shape-option"
      :class="{ 'is-active': model === shape }"
      role="radio"
      :aria-checked="model === shape ? 'true' : 'false'"
      :data-tip="t(`tool.shapes.${shape}`)"
      @click="model = shape"
    >
      <svg viewBox="-12 -12 24 24" aria-hidden="true">
        <template v-if="shape === 'flower' || shape === 'scallop'">
          <circle :r="shape === 'flower' ? 6.6 : 9.4" />
          <circle v-for="(lobe, index) in lobes(shape)" :key="index" :cx="lobe.x" :cy="lobe.y" :r="lobe.r" />
        </template>
        <rect v-else-if="shape === 'square'" x="-10" y="-10" width="20" height="20" rx="3.2" />
        <polygon v-else-if="shape !== 'circle'" :points="polygon(shape)" />
        <circle v-else r="10.5" />
      </svg>
      <span class="shape-option__name">{{ t(`tool.shapes.${shape}`) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { COASTER_SHAPES, type CoasterShape } from '../catalog';

defineProps<{ label: string }>();
const model = defineModel<CoasterShape>({ required: true });
const { t } = useI18n();

const lobes = (shape: 'flower' | 'scallop') => {
  const count = shape === 'flower' ? 8 : 18;
  const distance = shape === 'flower' ? 7 : 9.6;
  const radius = shape === 'flower' ? 3.9 : 1.75;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, r: radius };
  });
};

const polygon = (shape: CoasterShape) => {
  if (shape === 'gear') {
    const points: string[] = [];
    const teeth = 12;
    for (let i = 0; i < teeth; i += 1) {
      const start = (i / teeth) * Math.PI * 2;
      const step = (Math.PI * 2) / teeth;
      [[0, 9.2], [0.2, 11.2], [0.5, 11.2], [0.7, 9.2]].forEach(([t0, r]) => {
        points.push(`${(Math.cos(start + t0 * step) * r).toFixed(2)},${(Math.sin(start + t0 * step) * r).toFixed(2)}`);
      });
    }
    return points.join(' ');
  }
  const sides = shape === 'hexagon' ? 6 : 8;
  const radius = 10.5 / Math.cos(Math.PI / sides);
  return Array.from({ length: sides }, (_, i) => {
    const angle = Math.PI / 2 + Math.PI / sides + (i / sides) * Math.PI * 2;
    return `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`;
  }).join(' ');
};
</script>

<style scoped>
.shape-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.shape-option {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 4px 6px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-3);
  transition: border-color var(--duration) ease, background-color var(--duration) ease, color var(--duration) ease, transform var(--duration-fast) ease;
}

.shape-option svg {
  width: 30px;
  height: 30px;
  fill: currentColor;
  transition: transform 300ms var(--ease-spring);
}

.shape-option:hover {
  border-color: var(--input-border-hover);
  color: var(--text-2);
}

.shape-option:hover svg {
  transform: rotate(-12deg) scale(1.06);
}

.shape-option.is-active {
  border-color: var(--accent-soft-border);
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-soft-border);
}

.shape-option__name {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-2);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
