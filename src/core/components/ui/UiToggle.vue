<template>
  <label class="switch" :class="{ 'is-disabled': disabled, 'switch--sm': small }" :title="title" @click.stop>
    <input
      v-model="model"
      type="checkbox"
      class="switch__input"
      role="switch"
      :disabled="disabled"
      :aria-checked="model ? 'true' : 'false'"
      :aria-label="ariaLabel || label || title"
    />
    <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
    <span v-if="label || $slots.default" class="switch__label"><slot>{{ label }}</slot></span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label?: string;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
  small?: boolean;
}>();

const model = defineModel<boolean>({ default: false });
</script>
