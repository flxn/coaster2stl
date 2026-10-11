<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast" tag="div" class="toast-host__stack">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast"
        :class="`toast--${item.type}`"
        role="status"
        @mouseenter="pause(item.id)"
        @mouseleave="resume(item.id)"
      >
        <UiIcon :name="item.icon || ICONS[item.type]" class="toast__icon" />
        <span class="toast__message">{{ item.message }}</span>
        <button v-if="item.action" type="button" class="btn btn--sm toast__action" @click="runAction(item.id, item.action.run)">
          {{ item.action.label }}
        </button>
        <button type="button" class="toast__close" :aria-label="t('close')" @click="dismiss(item.id)">
          <UiIcon name="x" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToasts, type ToastType } from '../composables/useToasts';
import UiIcon from './ui/UiIcon.vue';

const ICONS: Record<ToastType, string> = {
  success: 'circle-check',
  error: 'circle-x',
  warning: 'alert',
  info: 'info',
};

const { t } = useI18n();
const {
  toasts, dismiss, pause, resume,
} = useToasts();

const runAction = (id: number, run: () => void) => {
  dismiss(id);
  run();
};
</script>

<style>
.toast-host {
  position: fixed;
  z-index: 120;
  bottom: 160px;
  /* centered over the preview area, right of the settings sidebar */
  left: calc(50% + var(--sidebar-width) / 2);
  width: min(440px, calc(100vw - 24px));
  transform: translateX(-50%);
  pointer-events: none;
}

.toast-host__stack {
  display: grid;
  gap: 8px;
}

@media (max-width: 900px) {
  .toast-host {
    bottom: 132px;
    left: 50%;
  }
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 10px 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 14px;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.toast__icon {
  width: 19px;
  height: 19px;
}

.toast--success .toast__icon {
  color: var(--accent);
}

.toast--error .toast__icon {
  color: var(--danger);
}

.toast--warning .toast__icon {
  color: var(--warning);
}

.toast--info .toast__icon {
  color: var(--info-text);
}

.toast__message {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.4;
}

.toast__action {
  flex-shrink: 0;
}

.toast__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-3);
}

.toast__close:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.toast__close .svg-icon {
  width: 16px;
  height: 16px;
}

.toast-enter-active {
  transition: opacity 200ms ease, transform 320ms var(--ease-spring);
}

.toast-leave-active {
  position: absolute;
  width: 100%;
  transition: opacity 160ms ease, transform 160ms ease;
}

.toast-move {
  transition: transform 240ms var(--ease-out);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
