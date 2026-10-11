<template>
  <UiModal
    :open="open"
    :title="kind === 'png' ? t('exportingPng') : t('exportingStl')"
    :icon="kind === 'png' ? 'image' : 'download'"
    :size="showAd ? 'md' : 'sm'"
    @close="emit('close')"
  >
    <div class="export-modal" :class="{ 'has-ad': showAd }">
      <div v-if="showAd" class="export-modal__ad">
        <AdSlot name="export" label @state="adState = $event" />
      </div>
      <div class="export-modal__status">
        <div class="countdown" :class="{ 'is-done': seconds === 0 }" aria-hidden="true">
          <svg viewBox="0 0 120 120" class="countdown__ring">
            <circle class="countdown__track" cx="60" cy="60" r="52" />
            <circle class="countdown__progress" cx="60" cy="60" r="52" :style="progressStyle" />
          </svg>
          <span class="countdown__value">
            <Transition name="icon-swap" mode="out-in">
              <UiIcon v-if="seconds === 0" key="done" name="check" />
              <span v-else :key="seconds">{{ seconds }}</span>
            </Transition>
          </span>
        </div>
        <p class="export-modal__headline" role="status">
          {{ seconds > 0 ? t('downloadCountdown', { seconds }) : t('downloadStarting') }}
        </p>
        <p v-if="adState !== 'blocked'" class="export-modal__text">{{ t('downloadThankYou') }}</p>
        <template v-else>
          <p class="export-modal__text">{{ t('adblockMessage') }}</p>
          <a
            v-if="siteConfig.links.support"
            class="btn"
            :class="{ 'btn--danger': thanked }"
            :href="siteConfig.links.support"
            target="_blank"
            rel="noopener"
            @click="thanked = true"
          >
            <UiIcon name="heart" />
            <span>{{ thanked ? t('thankYou') : t('support') }}</span>
          </a>
        </template>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn btn--primary" @click="emit('close')">OK</button>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
/**
 * Shown while an export waits for its countdown (the export itself is started by App.vue).
 * Only used when an export ad unit is configured; without ads, files download immediately.
 */
import {
  computed, onBeforeUnmount, ref, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import siteConfig from '@/site.config';
import type { AdState } from '../ads';
import AdSlot from './AdSlot.vue';
import UiIcon from './ui/UiIcon.vue';
import UiModal from './ui/UiModal.vue';

const props = defineProps<{
  open: boolean;
  kind: 'stl' | 'png';
  /** seconds until the download starts */
  delay: number;
}>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const adState = ref<AdState>('loading');
const seconds = ref(props.delay);
const started = ref(false);
const thanked = ref(false);
let interval = 0;

const showAd = computed(() => adState.value === 'loading' || adState.value === 'filled');

const progressStyle = computed(() => {
  const circumference = 2 * Math.PI * 52;
  return {
    strokeDasharray: `${circumference}`,
    strokeDashoffset: started.value ? '0' : `${circumference}`,
    transitionDuration: `${props.delay}s`,
  };
});

watch(() => props.open, (open) => {
  window.clearInterval(interval);
  if (!open) {
    return;
  }
  adState.value = 'loading';
  seconds.value = props.delay;
  started.value = false;
  requestAnimationFrame(() => {
    started.value = true;
  });
  interval = window.setInterval(() => {
    seconds.value = Math.max(0, seconds.value - 1);
    if (seconds.value === 0) {
      window.clearInterval(interval);
    }
  }, 1000);
}, { immediate: true });

onBeforeUnmount(() => window.clearInterval(interval));
</script>

<style>
.export-modal {
  display: grid;
  gap: 20px;
}

.export-modal.has-ad {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.export-modal__ad {
  display: flex;
  justify-content: center;
  min-width: 300px;
}

.export-modal__status {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 8px 0;
  text-align: center;
}

.export-modal__headline {
  margin: 0;
  color: var(--text);
  font-size: 17px;
  font-weight: 600;
}

.export-modal__text {
  margin: 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.55;
}

.countdown {
  position: relative;
  width: 104px;
  height: 104px;
}

.countdown__ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown__track {
  fill: none;
  stroke: var(--surface-inset);
  stroke-width: 8;
}

.countdown__progress {
  fill: none;
  stroke: var(--accent);
  stroke-width: 8;
  stroke-linecap: round;
  transition-property: stroke-dashoffset;
  transition-timing-function: linear;
}

.countdown__value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  font-size: 34px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.countdown__value .svg-icon {
  width: 40px;
  height: 40px;
  color: var(--accent);
}

.countdown.is-done {
  animation: countdown-pop 420ms var(--ease-spring);
}

@keyframes countdown-pop {
  0% {
    transform: scale(1);
  }

  45% {
    transform: scale(1.08);
  }

  100% {
    transform: scale(1);
  }
}

@media (max-width: 720px) {
  .export-modal.has-ad {
    grid-template-columns: 1fr;
  }
}
</style>
