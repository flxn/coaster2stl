<template>
  <section class="panel-section" :class="{ 'is-open': isOpen, 'is-settled': settled, 'is-disabled': toggleable && !enabled }">
    <div class="panel-section__header">
      <button
        type="button"
        class="panel-section__toggle"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :aria-controls="bodyId"
        :title="toggleable ? toggleTitle : undefined"
        @click="setOpen(!isOpen)"
      >
        <UiIcon name="chevron-right" class="panel-section__chevron" />
        <span class="panel-section__title">{{ title }}</span>
      </button>
      <div v-if="toggleable || $slots.aside" class="panel-section__aside">
        <UiToggle v-if="toggleable" :model-value="enabled" :title="toggleTitle" :aria-label="title" @update:model-value="onToggle" />
        <slot name="aside" :open="isOpen" />
      </div>
    </div>
    <div :id="bodyId" class="panel-section__body" @transitionend.self="onTransitionEnd">
      <div class="panel-section__inner">
        <div class="panel-section__content">
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Collapsible group of settings. With `toggleable`, a switch in the header turns the feature
 * on and off (v-model:enabled) and opens or closes the section with it.
 */
import { ref, useId } from 'vue';
import UiIcon from './UiIcon.vue';
import UiToggle from './UiToggle.vue';

const props = defineProps<{
  title: string;
  defaultOpen?: boolean;
  toggleable?: boolean;
  toggleTitle?: string;
}>();

const enabled = defineModel<boolean>('enabled', { default: false });

const bodyId = `section-body-${useId()}`;
const isOpen = ref(props.defaultOpen || (props.toggleable && enabled.value));
const settled = ref(isOpen.value);

const setOpen = (open: boolean) => {
  if (open === isOpen.value) {
    return;
  }
  isOpen.value = open;
  settled.value = false;
};

const onToggle = (value: boolean) => {
  enabled.value = value;
  setOpen(value);
};

const onTransitionEnd = (event: TransitionEvent) => {
  if (event.propertyName === 'grid-template-rows' && isOpen.value) {
    settled.value = true;
  }
};
</script>
