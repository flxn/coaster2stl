<template>
  <div ref="root" class="tabs" role="tablist" :aria-label="ariaLabel" @keydown="onKeydown">
    <button
      v-for="(tab, index) in tabs"
      :id="`tab-${tab.id}-${uid}`"
      :key="tab.id"
      :ref="(el) => { tabRefs[index] = el as HTMLButtonElement }"
      type="button"
      class="tabs__tab"
      :class="{ 'is-active': tab.id === model }"
      role="tab"
      :aria-selected="tab.id === model ? 'true' : 'false'"
      :tabindex="tab.id === model ? 0 : -1"
      @click="model = tab.id"
    >
      <UiIcon v-if="tab.icon" :name="tab.icon" />
      <span>{{ tab.label }}</span>
      <span v-if="tab.badge" class="badge">{{ tab.badge }}</span>
    </button>
    <span class="tabs__ink" :style="inkStyle" aria-hidden="true"></span>
  </div>
</template>

<script setup lang="ts">
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch,
} from 'vue';
import type { Tab } from './types';
import UiIcon from './UiIcon.vue';

const props = defineProps<{
  tabs: Tab[];
  ariaLabel?: string;
}>();

const model = defineModel<string>({ required: true });

const uid = useId();
const root = useTemplateRef<HTMLDivElement>('root');
const tabRefs = ref<HTMLButtonElement[]>([]);
const inkX = ref(0);
const inkWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

const inkStyle = computed(() => ({
  width: `${inkWidth.value}px`,
  transform: `translateX(${inkX.value}px)`,
}));

const measure = () => {
  const el = tabRefs.value[props.tabs.findIndex((tab) => tab.id === model.value)];
  if (!el) {
    inkWidth.value = 0;
    return;
  }
  // the ink is a little narrower than the tab, centered under it
  const inset = Math.max(12, el.offsetWidth * 0.12);
  inkX.value = el.offsetLeft + inset;
  inkWidth.value = Math.max(0, el.offsetWidth - inset * 2);
};

watch([model, () => props.tabs], () => nextTick(measure));

const onKeydown = (event: KeyboardEvent) => {
  const delta = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[event.key];
  if (!delta) {
    return;
  }
  event.preventDefault();
  const index = props.tabs.findIndex((tab) => tab.id === model.value);
  const nextIndex = (index + delta + props.tabs.length) % props.tabs.length;
  model.value = props.tabs[nextIndex].id;
  nextTick(() => tabRefs.value[nextIndex]?.focus());
};

onMounted(() => {
  measure();
  resizeObserver = new ResizeObserver(measure);
  if (root.value) {
    resizeObserver.observe(root.value);
  }
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>
