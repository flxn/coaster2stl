<template>
  <div ref="root" class="segmented" :class="classes" role="radiogroup" :aria-label="ariaLabel" @keydown="onKeydown">
    <span class="segmented__indicator" :class="{ 'no-anim': !animate }" :style="indicatorStyle" aria-hidden="true"></span>
    <button
      v-for="(option, index) in options"
      :key="String(option.value)"
      :ref="(el) => { items[index] = el as HTMLButtonElement }"
      type="button"
      class="segmented__item"
      :class="{ 'is-active': option.value === model }"
      role="radio"
      :aria-checked="option.value === model ? 'true' : 'false'"
      :aria-label="iconsOnly ? (option.tip || option.label) : undefined"
      :tabindex="option.value === model ? 0 : -1"
      :disabled="option.disabled"
      :title="option.title"
      :data-tip="option.tip"
      :data-tip-pos="tipPos"
      @click="select(option)"
    >
      <UiIcon v-if="option.icon" :name="option.icon" />
      <span v-if="!iconsOnly && option.label">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number | boolean">
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch,
} from 'vue';
import type { SegmentedOption } from './types';
import UiIcon from './UiIcon.vue';

const props = withDefaults(defineProps<{
  options: SegmentedOption<T>[];
  variant?: 'track' | 'accent';
  block?: boolean;
  size?: 'md' | 'lg';
  iconsOnly?: boolean;
  ariaLabel?: string;
  tipPos?: 'top' | 'bottom' | 'left' | 'right';
}>(), {
  variant: 'track',
  size: 'md',
  ariaLabel: undefined,
  tipPos: 'top',
});

const model = defineModel<T>({ required: true });

const root = useTemplateRef<HTMLDivElement>('root');
const items = ref<HTMLButtonElement[]>([]);
const indicatorX = ref(0);
const indicatorWidth = ref(0);
const animate = ref(false);
let resizeObserver: ResizeObserver | null = null;

const classes = computed(() => ({
  'segmented--accent': props.variant === 'accent',
  'segmented--block': props.block,
  'segmented--lg': props.size === 'lg',
  'segmented--icons': props.iconsOnly,
}));

const indicatorStyle = computed(() => ({
  width: `${indicatorWidth.value}px`,
  transform: `translateX(${indicatorX.value}px)`,
  opacity: indicatorWidth.value ? 1 : 0,
}));

const measure = () => {
  const item = items.value[props.options.findIndex((option) => option.value === model.value)];
  if (!item || !item.offsetWidth) {
    indicatorWidth.value = 0;
    return;
  }
  indicatorX.value = item.offsetLeft;
  indicatorWidth.value = item.offsetWidth;
};

watch([model, () => props.options], () => nextTick(measure));

const select = (option: SegmentedOption<T>) => {
  if (!option.disabled && option.value !== model.value) {
    model.value = option.value;
  }
};

const onKeydown = (event: KeyboardEvent) => {
  const delta = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key];
  if (!delta) {
    return;
  }
  event.preventDefault();
  const enabled = props.options.filter((option) => !option.disabled);
  const current = enabled.findIndex((option) => option.value === model.value);
  const next = enabled[(current + delta + enabled.length) % enabled.length];
  if (next) {
    select(next);
    nextTick(() => items.value[props.options.indexOf(next)]?.focus());
  }
};

onMounted(() => {
  measure();
  // enable the sliding animation only after the first layout
  requestAnimationFrame(() => {
    animate.value = true;
  });
  resizeObserver = new ResizeObserver(measure);
  if (root.value) {
    resizeObserver.observe(root.value);
  }
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>
