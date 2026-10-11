<template>
  <span class="help-tip" @mouseenter="show" @mouseleave="scheduleHide">
    <button
      ref="trigger"
      type="button"
      class="help-tip__button"
      :aria-label="ariaLabel"
      :aria-expanded="open ? 'true' : 'false'"
      @click.stop.prevent="toggle"
      @focus="show"
      @blur="scheduleHide"
      @keydown.esc="hide"
    >
      <UiIcon name="help" />
    </button>
    <Teleport to="body">
      <Transition name="popover">
        <span
          v-if="open"
          ref="bubble"
          class="help-tip__bubble"
          role="tooltip"
          :style="bubbleStyle"
          @mouseenter="cancelHide"
          @mouseleave="scheduleHide"
        ><slot>{{ cleanText }}</slot></span>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import {
  computed, nextTick, onBeforeUnmount, ref, useTemplateRef,
} from 'vue';
import UiIcon from './UiIcon.vue';

const props = withDefaults(defineProps<{
  text?: string;
  ariaLabel?: string;
}>(), {
  text: '',
  ariaLabel: 'Help',
});

const open = ref(false);
const bubbleStyle = ref<Record<string, string>>({});
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const bubble = useTemplateRef<HTMLSpanElement>('bubble');
let hideTimer = 0;

// translations may be written as indented template literals
const cleanText = computed(() => props.text.replace(/\s+/g, ' ').trim());

const position = () => {
  if (!trigger.value || !bubble.value) {
    return;
  }
  const rect = trigger.value.getBoundingClientRect();
  const width = Math.min(300, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
  const height = bubble.value.offsetHeight;
  const below = rect.bottom + 8 + height < window.innerHeight - 8;
  bubbleStyle.value = {
    width: `${width}px`,
    left: `${left}px`,
    top: below ? `${rect.bottom + 8}px` : `${Math.max(8, rect.top - height - 8)}px`,
    '--popover-origin': below ? 'top center' : 'bottom center',
  };
};

const cancelHide = () => window.clearTimeout(hideTimer);

const hide = () => {
  open.value = false;
  window.removeEventListener('scroll', hide, true);
};

const show = () => {
  cancelHide();
  if (open.value) {
    return;
  }
  open.value = true;
  window.addEventListener('scroll', hide, true);
  nextTick(position);
};

const toggle = () => (open.value ? hide() : show());

const scheduleHide = () => {
  cancelHide();
  hideTimer = window.setTimeout(hide, 140);
};

onBeforeUnmount(() => {
  cancelHide();
  window.removeEventListener('scroll', hide, true);
});
</script>

<style>
.help-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.help-tip__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-3);
  transition: color var(--duration) ease, background-color var(--duration) ease;
}

.help-tip__button:hover,
.help-tip__button[aria-expanded="true"] {
  color: var(--accent-text);
  background: var(--accent-soft);
}

.help-tip__button .svg-icon {
  width: 16px;
  height: 16px;
}

.help-tip__bubble {
  position: fixed;
  z-index: 90;
  display: block;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.5;
  white-space: normal;
  text-align: left;
  box-shadow: var(--shadow-lg);
  transform-origin: var(--popover-origin, top center);
}
</style>
