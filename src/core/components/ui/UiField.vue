<template>
  <div :class="[stack ? 'field-stack' : 'field-row', { 'field-row--top': top && !stack }]">
    <span class="field-label">
      <label :for="forId" :title="title">{{ label }}</label>
      <UiHelp v-if="help" :text="help" />
    </span>
    <div class="field-row__control" :class="{ 'field-row__control--inline': inline }">
      <slot />
    </div>
    <div v-if="hint || $slots.hint" class="field-hint" :class="{ 'field-row__hint': !stack }">
      <slot name="hint">{{ hint }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiHelp from './UiHelp.vue';

defineProps<{
  label: string;
  forId?: string;
  title?: string;
  help?: string;
  hint?: string;
  /** label above the control instead of next to it */
  stack?: boolean;
  /** align the label with the top of a tall control */
  top?: boolean;
  inline?: boolean;
}>();
</script>
