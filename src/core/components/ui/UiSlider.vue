<template>
  <div class="field-row">
    <span class="field-label">
      <label :for="inputId">{{ label }}</label>
      <UiHelp v-if="help" :text="help" />
    </span>
    <div class="field-row__control slider">
      <input
        :id="inputId"
        v-model.number="model"
        class="slider__input"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :style="{ '--fill': `${fill}%` }"
      />
      <button type="button" class="slider__value" :title="resetLabel" :disabled="model === resetTo" @click="model = resetTo">
        {{ model }}{{ unit }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Range slider with the value next to it; clicking the value resets it. */
import { computed, useId } from 'vue';
import UiHelp from './UiHelp.vue';

const props = withDefaults(defineProps<{
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  help?: string;
  /** value restored by clicking the number */
  resetTo: number;
  resetLabel?: string;
}>(), {
  step: 1,
  unit: '',
  help: '',
  resetLabel: undefined,
});

const model = defineModel<number>({ required: true });
const inputId = `slider-${useId()}`;
const fill = computed(() => ((Number(model.value) - props.min) / (props.max - props.min)) * 100);
</script>

<style>
.slider {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider__input {
  flex: 1 1 auto;
  min-width: 0;
  height: 22px;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.slider__input::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--accent) var(--fill), var(--switch-off) var(--fill));
}

.slider__input::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--accent) var(--fill), var(--switch-off) var(--fill));
}

.slider__input::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -6px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35), 0 0 0 0.5px rgba(0, 0, 0, 0.06);
  appearance: none;
  transition: transform var(--duration-fast) ease;
}

.slider__input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.slider__input:active::-webkit-slider-thumb {
  transform: scale(1.12);
}

.slider__input:focus-visible {
  outline: none;
}

.slider__input:focus-visible::-webkit-slider-thumb {
  box-shadow: var(--focus-ring);
}

.slider__value {
  flex-shrink: 0;
  min-width: 52px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--unit-bg);
  color: var(--text);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.slider__value:not(:disabled):hover {
  border-color: var(--input-border-hover);
}

.slider__value:disabled {
  cursor: default;
}
</style>
