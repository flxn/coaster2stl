<template>
  <svg class="mdi-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path :d="path" fill="currentColor" />
  </svg>
</template>

<script setup lang="ts">
/** A filled icon from SVG path data (24×24), as used for the printed icons. */
defineProps<{ path: string }>();
</script>

<style scoped>
.mdi-icon {
  display: inline-block;
  flex-shrink: 0;
  width: 1.2em;
  height: 1.2em;
}
</style>
