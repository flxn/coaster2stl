<template>
  <div class="action-bar">
    <div class="action-bar__inner">
      <button
        type="button"
        class="btn btn--lg btn--accent-outline generate-button"
        :class="{ 'is-busy': isGenerating, 'is-stale': isStale && !isGenerating, 'is-nudged': nudged }"
        :data-tip="generateTip"
        :aria-busy="isGenerating ? 'true' : 'false'"
        @click="emit('generate')"
        @animationend="nudged = false"
      >
        <span class="generate-button__icon">
          <Transition name="icon-swap" mode="out-in">
            <UiIcon v-if="isGenerating" key="busy" name="loader" class="spin" />
            <UiIcon v-else-if="justFinished" key="done" name="check" class="generate-button__done" />
            <UiIcon v-else key="idle" name="play" />
          </Transition>
        </span>
        <span class="generate-button__label">{{ t('generateButton') }}</span>
        <span v-if="isStale && !isGenerating" class="dot-badge dot-badge--pulse" aria-hidden="true"></span>
      </button>

      <span class="action-divider" aria-hidden="true"></span>

      <div class="action-field">
        <label class="action-field__label" :for="formatId">{{ t('stlFormat') }}</label>
        <div class="select action-select">
          <select :id="formatId" v-model="format">
            <option value="binary">{{ t('stlBinary') }}</option>
            <option value="ascii">{{ t('stlAscii') }}</option>
          </select>
          <UiIcon name="chevron-down" class="select__chevron" />
        </div>
        <UiHelp class="action-field__help" :text="t('stlFormatHelp')" />
      </div>

      <span class="action-divider" aria-hidden="true"></span>

      <div class="action-field">
        <UiToggle v-model="separateParts" :label="t('separateParts')" class="action-toggle" />
        <UiHelp :text="t('separatePartsHelp')" />
      </div>

      <span class="action-spacer" aria-hidden="true"></span>

      <div class="action-bar__exports">
        <button
          type="button"
          class="btn btn--lg export-png"
          :class="{ 'is-disabled': !hasModel }"
          :aria-disabled="hasModel ? 'false' : 'true'"
          :data-tip="hasModel ? t('renderPngTip') : t('generateFirst')"
          @click="onExport('render-png')"
        >
          <UiIcon name="image" />
          <span class="export-png__label">{{ t('renderPng') }}</span>
        </button>
        <button
          type="button"
          class="btn btn--lg btn--primary export-stl"
          :class="{ 'is-disabled': !hasModel }"
          :aria-disabled="hasModel ? 'false' : 'true'"
          :data-tip="hasModel ? `${t('exportStl')} · ${modifierKey} S` : t('generateFirst')"
          data-tip-align="end"
          @click="onExport('export-stl')"
        >
          <UiIcon name="download" />
          <span>{{ t('exportStl') }}</span>
        </button>
      </div>

      <span class="action-break" aria-hidden="true"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, nextTick, onBeforeUnmount, ref, useId, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import type { StlFormat } from '../export/stl';
import { modifierKey } from '../utils/platform';
import UiHelp from './ui/UiHelp.vue';
import UiIcon from './ui/UiIcon.vue';
import UiToggle from './ui/UiToggle.vue';

const props = defineProps<{
  isGenerating: boolean;
  isStale: boolean;
  hasModel: boolean;
  /** increases with every finished generation; briefly shows a check mark */
  completedGenerations: number;
}>();

const format = defineModel<StlFormat>('format', { required: true });
const separateParts = defineModel<boolean>('separateParts', { required: true });

const emit = defineEmits<{
  generate: [];
  'export-stl': [];
  'render-png': [];
  'need-model': [];
}>();

const { t } = useI18n();
const formatId = `stl-format-${useId()}`;
const nudged = ref(false);
const justFinished = ref(false);
let finishedTimer = 0;

const generateTip = computed(() => (props.isStale && !props.isGenerating
  ? `${t('settingsChanged')} · ${modifierKey} ↵`
  : `${t('generateButton')} · ${modifierKey} ↵`));

watch(() => props.completedGenerations, () => {
  window.clearTimeout(finishedTimer);
  justFinished.value = true;
  finishedTimer = window.setTimeout(() => {
    justFinished.value = false;
  }, 1200);
});

/** Draws attention to the generate button (e.g. when exporting without a model). */
const nudge = () => {
  nudged.value = false;
  nextTick(() => {
    nudged.value = true;
  });
};

const onExport = (event: 'export-stl' | 'render-png') => {
  if (!props.hasModel) {
    nudge();
    emit('need-model');
    return;
  }
  if (event === 'export-stl') {
    emit('export-stl');
  } else {
    emit('render-png');
  }
};

onBeforeUnmount(() => window.clearTimeout(finishedTimer));

defineExpose({ nudge });
</script>

<style>
.action-bar {
  container-type: inline-size;
  container-name: actionbar;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
}

.action-bar__inner {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 72px;
  padding: 11px 12px;
}

.action-divider {
  flex-shrink: 0;
  width: 1px;
  height: 32px;
  background: var(--divider);
}

.action-spacer {
  flex: 1 1 auto;
}

.action-break {
  display: none;
}

.action-field {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.action-field__label {
  color: var(--text-2);
  font-size: 14px;
  white-space: nowrap;
}

.action-select select {
  width: 150px;
  height: 42px;
}

.action-toggle .switch__label {
  color: var(--text-2);
  white-space: nowrap;
}

.action-bar__exports {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.action-bar .btn--lg {
  height: 50px;
}

.action-bar .btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.action-bar .btn.is-disabled:active {
  transform: none;
}

.export-stl {
  min-width: 190px;
}

.generate-button {
  flex-shrink: 0;
  min-width: 218px;
  border-width: 1.5px;
}

.generate-button__icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
}

.generate-button__done {
  color: var(--accent);
}

.generate-button.is-stale {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.generate-button.is-nudged {
  animation: nudge 520ms var(--ease-out);
}

@keyframes nudge {
  0%,
  100% {
    transform: translateX(0);
  }

  20% {
    transform: translateX(-5px);
  }

  40% {
    transform: translateX(5px);
  }

  60% {
    transform: translateX(-3px);
  }

  80% {
    transform: translateX(2px);
  }
}

.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: opacity 120ms ease, transform 160ms var(--ease-out);
}

.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.6) rotate(-30deg);
}

@container actionbar (max-width: 1220px) {
  .action-field__label {
    display: none;
  }

  .action-select select {
    width: 136px;
  }
}

@container actionbar (max-width: 1100px) {
  .export-png__label {
    display: none;
  }

  .export-stl {
    min-width: 0;
  }

  .export-png {
    width: 50px;
    padding: 0;
  }

  .generate-button {
    min-width: 0;
  }

  .action-field__help {
    display: none;
  }
}

@container actionbar (max-width: 900px) {
  .action-bar__inner {
    flex-wrap: wrap;
    row-gap: 10px;
  }

  .action-divider,
  .action-spacer {
    display: none;
  }

  /* row 1: generate + exports, row 2: export options */
  .generate-button {
    order: 1;
    flex: 1 1 auto;
  }

  .action-bar__exports {
    order: 2;
  }

  .action-break {
    display: block;
    order: 3;
    flex-basis: 100%;
    height: 0;
  }

  .action-field {
    order: 4;
  }

  .export-stl {
    min-width: 0;
  }
}

@container actionbar (max-width: 560px) {
  .action-bar__inner {
    gap: 10px;
    padding: 10px;
  }

  .action-bar__exports {
    display: contents;
  }

  .action-bar .btn--lg {
    gap: 6px;
    padding: 0 12px;
    font-size: 14px;
  }

  .generate-button,
  .export-stl {
    flex: 1 1 0;
    min-width: 0;
  }

  .generate-button {
    order: 1;
  }

  .export-stl {
    order: 2;
  }

  .export-png {
    order: 5;
    margin-left: auto;
  }

  .action-select select {
    width: 128px;
  }
}

@container actionbar (max-width: 420px) {
  .generate-button__icon,
  .export-stl .svg-icon,
  .action-field .help-tip {
    display: none;
  }

  .action-select select {
    width: 124px;
  }

  .action-bar .export-png {
    width: 44px;
  }
}
</style>
