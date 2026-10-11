<template>
  <div class="pattern-picker" role="radiogroup" :aria-label="label">
    <button
      v-for="pattern in PATTERNS"
      :key="pattern"
      type="button"
      class="pattern-option"
      :class="{ 'is-active': model === pattern }"
      role="radio"
      :aria-checked="model === pattern ? 'true' : 'false'"
      @click="model = pattern"
    >
      <svg viewBox="-12 -12 24 24" aria-hidden="true">
        <defs>
          <clipPath :id="`pattern-clip-${uid}`"><circle r="11" /></clipPath>
        </defs>
        <circle r="11" class="pattern-option__base" />
        <g :clip-path="`url(#pattern-clip-${uid})`" class="pattern-option__ink">
          <template v-if="pattern === 'rings'">
            <circle v-for="r in [2.6, 5.4, 8.2, 11]" :key="r" :r="r" fill="none" stroke="currentColor" stroke-width="1.1" />
          </template>
          <template v-else-if="pattern === 'dots'">
            <circle v-for="(dot, i) in dots" :key="i" :cx="dot[0]" :cy="dot[1]" r="1.15" />
          </template>
          <template v-else-if="pattern === 'honeycomb'">
            <polygon v-for="(cell, i) in hexes" :key="i" :points="cell" fill="none" stroke="currentColor" stroke-width="0.9" />
          </template>
          <template v-else-if="pattern === 'waves'">
            <path v-for="y in [-9, -4.5, 0, 4.5, 9]" :key="y" :d="wave(y)" fill="none" stroke="currentColor" stroke-width="1.2" />
          </template>
          <template v-else-if="pattern === 'sunburst'">
            <polygon v-for="(ray, i) in rays" :key="i" :points="ray" />
          </template>
          <template v-else-if="pattern === 'checker'">
            <rect v-for="(square, i) in squares" :key="i" :x="square[0]" :y="square[1]" width="4" height="4" />
          </template>
          <template v-else-if="pattern === 'terrazzo'">
            <polygon v-for="(chip, i) in chips" :key="i" :points="chip" />
          </template>
        </g>
      </svg>
      <span class="pattern-option__name">{{ t(`tool.patterns.${pattern}`) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { PATTERNS, type PatternId } from '../catalog';
import { seededRandom } from '../patterns';

defineProps<{ label: string }>();
const model = defineModel<PatternId>({ required: true });
const { t } = useI18n();
const uid = useId();

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const dots = range(-12, 12, 3.6).flatMap((y, row) => range(-12, 12, 4).map((x) => [x + (row % 2) * 2, y]));
const hexes = range(-15, 15, 5.2).flatMap((x, col) => range(-15, 15, 6).map((y) => {
  const cy = y + (col % 2) * 3;
  return Array.from({ length: 6 }, (_, i) => `${(x + Math.cos((i * Math.PI) / 3) * 3.4).toFixed(2)},${(cy + Math.sin((i * Math.PI) / 3) * 3.4).toFixed(2)}`).join(' ');
}));
const wave = (y: number) => `M-12 ${y} ${range(-12, 12, 1).map((x) => `L${x} ${(y + Math.sin(x / 1.6) * 1.4).toFixed(2)}`).join(' ')}`;
const rays = range(0, 15, 1).filter((i) => i % 2 === 0).map((i) => {
  const a = (i / 16) * Math.PI * 2;
  const b = ((i + 1) / 16) * Math.PI * 2;
  return `0,0 ${Math.cos(a) * 14},${Math.sin(a) * 14} ${Math.cos(b) * 14},${Math.sin(b) * 14}`;
});
const squares = range(-12, 8, 4).flatMap((y, row) => range(-12, 8, 4).filter((_, col) => (row + col) % 2 === 0).map((x) => [x, y]));
const random = seededRandom(3);
const chips = Array.from({ length: 22 }, () => {
  const cx = (random() - 0.5) * 22;
  const cy = (random() - 0.5) * 22;
  const size = 0.8 + random() * 1.4;
  return Array.from({ length: 5 }, (_, k) => {
    const angle = (k / 5) * Math.PI * 2 + random();
    return `${(cx + Math.cos(angle) * size).toFixed(2)},${(cy + Math.sin(angle) * size).toFixed(2)}`;
  }).join(' ');
});
</script>

<style scoped>
.pattern-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.pattern-option {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
  padding: 7px 4px 6px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-2);
  transition: border-color var(--duration) ease, background-color var(--duration) ease;
}

.pattern-option svg {
  width: 34px;
  height: 34px;
  transition: transform 400ms var(--ease-spring);
}

.pattern-option:hover svg {
  transform: rotate(20deg);
}

.pattern-option__base {
  fill: var(--surface-inset);
  stroke: var(--border-strong);
  stroke-width: 0.6;
}

.pattern-option__ink {
  color: var(--text-3);
  fill: currentColor;
}

.pattern-option:hover {
  border-color: var(--input-border-hover);
}

.pattern-option.is-active {
  border-color: var(--accent-soft-border);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent-soft-border);
}

.pattern-option.is-active .pattern-option__ink {
  color: var(--accent);
}

.pattern-option__name {
  max-width: 100%;
  overflow: hidden;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
