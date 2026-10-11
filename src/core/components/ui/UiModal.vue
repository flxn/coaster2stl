<template>
  <Teleport to="body">
    <Transition name="modal" :duration="{ enter: 300, leave: 180 }">
      <div v-if="open" class="modal" :class="sizeClass" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <div class="modal__backdrop" @click="closeOnBackdrop && emit('close')"></div>
        <div ref="panel" class="modal__panel" tabindex="-1">
          <header class="modal__header">
            <span v-if="icon" class="modal__icon"><UiIcon :name="icon" /></span>
            <div class="modal__titles">
              <h2 :id="titleId" class="modal__title">
                <slot name="title">{{ title }}</slot>
              </h2>
              <p v-if="subtitle" class="modal__subtitle">{{ subtitle }}</p>
            </div>
            <slot name="header-extra" />
            <button type="button" class="btn btn--ghost btn--icon btn--sm" :aria-label="t('close')" @click="emit('close')">
              <UiIcon name="x" />
            </button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
// stack of open modals: Escape closes the top-most one
const openModals: (() => void)[] = [];

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && openModals.length && !event.defaultPrevented) {
    openModals[openModals.length - 1]();
  }
};
</script>

<script setup lang="ts">
import {
  computed, nextTick, onBeforeUnmount, useId, useTemplateRef, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from './UiIcon.vue';

const props = withDefaults(defineProps<{
  open: boolean;
  title?: string;
  subtitle?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}>(), {
  title: '',
  subtitle: '',
  icon: '',
  size: 'sm',
  closeOnBackdrop: true,
});

const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const titleId = `modal-title-${useId()}`;
const sizeClass = computed(() => (props.size === 'sm' ? '' : `modal--${props.size}`));
const panel = useTemplateRef<HTMLDivElement>('panel');
const close = () => emit('close');
let previousFocus: HTMLElement | null = null;

const register = () => {
  previousFocus = document.activeElement as HTMLElement | null;
  if (!openModals.length) {
    document.addEventListener('keydown', onKeydown);
  }
  openModals.push(close);
  document.documentElement.classList.add('has-modal');
  nextTick(() => {
    if (panel.value && !panel.value.contains(document.activeElement)) {
      panel.value.focus({ preventScroll: true });
    }
  });
};

const unregister = () => {
  const index = openModals.indexOf(close);
  if (index === -1) {
    return;
  }
  openModals.splice(index, 1);
  if (!openModals.length) {
    document.removeEventListener('keydown', onKeydown);
    document.documentElement.classList.remove('has-modal');
  }
  previousFocus?.focus?.({ preventScroll: true });
};

watch(() => props.open, (open) => (open ? register() : unregister()), { immediate: true });
onBeforeUnmount(unregister);
</script>

<style>
.modal__panel:focus {
  outline: none;
}
</style>
