<template>
  <div :class="stack ? 'field-stack' : 'field-row'">
    <span class="field-label">
      <label
        :for="inputId"
        :class="{ 'is-scrubbable': !disabled, 'is-scrubbing': scrubbing }"
        :title="title"
        @pointerdown="onScrubStart"
        @click="onLabelClick"
      >{{ label }}</label>
      <UiHelp v-if="help" :text="help" />
    </span>
    <div class="field-row__control">
      <div class="input-group" :class="{ 'is-invalid': isInvalid, 'is-flash': flash }">
        <input
          :id="inputId"
          class="input-group__input"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          :value="text"
          :placeholder="placeholder"
          :disabled="disabled"
          :title="title"
          :aria-label="label"
          @input="onInput"
          @focus="focused = true"
          @blur="onBlur"
          @keydown="onKeydown"
        />
        <span v-if="unit" class="input-group__unit" aria-hidden="true">{{ unit }}</span>
      </div>
      <slot />
    </div>
    <div v-if="hint" class="field-hint field-row__hint">{{ hint }}</div>
    <Transition name="rise">
      <div v-if="warning" class="field-hint field-hint--warning" role="status">
        <UiIcon name="alert" />
        <span>{{ warning }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * Number input with a unit suffix.
 * - the value is NaN while the field is empty (hasValidNumbers() then pauses live updates)
 * - arrow keys step the value (Shift ×10, Alt ÷10); dragging the label scrubs it
 * - min / max are applied when the field loses focus
 */
import {
  computed, nextTick, onBeforeUnmount, ref, useId, watch,
} from 'vue';
import UiHelp from './UiHelp.vue';
import UiIcon from './UiIcon.vue';

const PIXELS_PER_STEP = 4;

const props = withDefaults(defineProps<{
  label: string;
  unit?: string;
  title?: string;
  help?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  stack?: boolean;
  hint?: string;
  /** shown below the field, e.g. when the generator had to adjust this value */
  warning?: string;
}>(), {
  unit: 'mm',
  title: undefined,
  help: '',
  step: 1,
  min: -Infinity,
  max: Infinity,
  placeholder: '',
  hint: '',
  warning: '',
});

const model = defineModel<number>({ required: true });
const emit = defineEmits<{ change: [value: number] }>();

const inputId = `number-field-${useId()}`;
const format = (value: number) => (Number.isFinite(value) ? String(value) : '');
const text = ref(format(model.value));
const focused = ref(false);
const scrubbing = ref(false);
const flash = ref(false);
let flashTimer = 0;
let justScrubbed = false;
let scrubState: {
  pointerId: number; startX: number; startValue: number; moved: boolean; changed: boolean;
} | null = null;

const isInvalid = computed(() => !focused.value && !Number.isFinite(model.value));

const parse = (value: string): number => {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '.') {
    return Number.NaN;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
};

const decimals = (() => {
  const index = String(props.step).indexOf('.');
  return Math.max(index === -1 ? 0 : String(props.step).length - index - 1, 2);
})();
const round = (value: number) => Number(value.toFixed(decimals));
const clamp = (value: number) => Math.min(props.max, Math.max(props.min, value));
const same = (a: number, b: number) => a === b || (Number.isNaN(a) && Number.isNaN(b));

const triggerFlash = () => {
  flash.value = false;
  window.clearTimeout(flashTimer);
  nextTick(() => {
    flash.value = true;
    flashTimer = window.setTimeout(() => {
      flash.value = false;
    }, 600);
  });
};

watch(model, (value) => {
  if (same(parse(text.value), value)) {
    return;
  }
  text.value = format(value);
  if (!focused.value && !scrubbing.value) {
    triggerFlash();
  }
});

const commit = (value: number, emitChange: boolean) => {
  text.value = format(value);
  if (!same(value, model.value)) {
    model.value = value;
  }
  if (emitChange) {
    emit('change', value);
  }
};

const onInput = (event: Event) => {
  text.value = (event.target as HTMLInputElement).value;
  const parsed = parse(text.value);
  if (!same(parsed, model.value)) {
    model.value = parsed;
  }
};

/** Parses the typed text and keeps it within min / max. */
const settle = () => {
  const parsed = parse(text.value);
  const value = Number.isNaN(parsed) ? parsed : clamp(parsed);
  if (value !== parsed && !Number.isNaN(value)) {
    triggerFlash();
  }
  commit(value, true);
};

const onBlur = () => {
  focused.value = false;
  settle();
};

const stepSize = (event: KeyboardEvent | PointerEvent) => {
  if (event.shiftKey) return props.step * 10;
  if (event.altKey) return props.step / 10;
  return props.step;
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
    if (event.key === 'Enter') {
      settle();
    }
    return;
  }
  event.preventDefault();
  const current = parse(text.value);
  const base = Number.isNaN(current) ? 0 : current;
  const delta = stepSize(event);
  commit(clamp(round(base + (event.key === 'ArrowUp' ? delta : -delta))), true);
};

const onScrubMove = (event: PointerEvent) => {
  const state = scrubState;
  if (!state || event.pointerId !== state.pointerId) {
    return;
  }
  const dx = event.clientX - state.startX;
  if (!state.moved && Math.abs(dx) < 3) {
    return;
  }
  if (!state.moved) {
    state.moved = true;
    scrubbing.value = true;
    document.documentElement.style.cursor = 'ew-resize';
    document.documentElement.style.userSelect = 'none';
  }
  const next = clamp(round(state.startValue + Math.round(dx / PIXELS_PER_STEP) * stepSize(event)));
  if (!same(next, parse(text.value))) {
    state.changed = true;
    commit(next, false);
  }
};

const stopScrub = () => {
  window.removeEventListener('pointermove', onScrubMove);
  window.removeEventListener('pointerup', onScrubEnd);
  window.removeEventListener('pointercancel', onScrubEnd);
  if (scrubbing.value) {
    document.documentElement.style.cursor = '';
    document.documentElement.style.userSelect = '';
  }
  scrubbing.value = false;
  scrubState = null;
};

function onScrubEnd() {
  const state = scrubState;
  stopScrub();
  if (state?.changed) {
    emit('change', parse(text.value));
  }
  justScrubbed = !!state?.moved;
}

const onScrubStart = (event: PointerEvent) => {
  if (props.disabled || event.button !== 0) {
    return;
  }
  const current = parse(text.value);
  scrubState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startValue: Number.isNaN(current) ? 0 : current,
    moved: false,
    changed: false,
  };
  window.addEventListener('pointermove', onScrubMove);
  window.addEventListener('pointerup', onScrubEnd);
  window.addEventListener('pointercancel', onScrubEnd);
};

const onLabelClick = (event: MouseEvent) => {
  // a drag on the label must not also focus the input
  if (justScrubbed) {
    event.preventDefault();
    justScrubbed = false;
  }
};

onBeforeUnmount(() => {
  window.clearTimeout(flashTimer);
  stopScrub();
});
</script>
