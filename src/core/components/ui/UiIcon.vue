<template>
  <svg
    class="svg-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="icons[name] || ''"
  />
</template>

<script setup lang="ts">
import icons from './icons';

const props = withDefaults(defineProps<{
  /** key of icons.ts */
  name: string;
  strokeWidth?: number | string;
}>(), {
  strokeWidth: 2,
});

if (import.meta.env.DEV && !icons[props.name]) {
  // only the icons in icons.ts are bundled; an unknown name renders nothing
  console.warn(`UiIcon: unknown icon "${props.name}", add it to src/core/components/ui/icons.ts`);
}
</script>
