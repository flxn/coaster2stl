<template>
  <div
    v-show="state !== 'hidden'"
    ref="root"
    class="ad-unit"
    :class="[`ad-unit--${state}`, { 'ad-unit--labeled': label }]"
    :style="reserveStyle"
  >
    <span v-if="label" class="ad-unit__label">{{ t('advertisement') }}</span>
    <!-- rendered only when the ad is requested: adsbygoogle.push() fills the first unfilled <ins> -->
    <ins
      v-if="layout && unit"
      ref="ins"
      class="adsbygoogle"
      :style="layout.style"
      :data-ad-client="adClient"
      :data-ad-slot="unit.slot"
      :data-ad-format="layout.format"
      :data-full-width-responsive="layout.format ? 'false' : undefined"
      :data-adtest="isAdTestMode() ? 'on' : undefined"
    ></ins>
  </div>
</template>

<script setup lang="ts">
/**
 * One AdSense display unit (configured in src/site.config.ts).
 * - requests the ad only once the slot is visible and has a width (AdSense cannot fill hidden units)
 * - uses the fixed size when it fits, otherwise a responsive unit so ads are never cropped
 * - reserves the height while loading and collapses when the ad is unfilled, blocked or not configured
 */
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef,
} from 'vue';
import { useI18n } from 'vue-i18n';
import {
  adClient, getAdUnit, isAdTestMode, requestAd, whenAdsReady, type AdName, type AdState,
} from '../ads';

const props = defineProps<{
  name: AdName;
  /** show a small "Advertisement" label above the ad */
  label?: boolean;
}>();

const emit = defineEmits<{ state: [state: AdState] }>();

const { t } = useI18n();
const root = useTemplateRef<HTMLDivElement>('root');
const ins = useTemplateRef<HTMLModElement>('ins');
const unit = getAdUnit(props.name);
const state = ref<AdState | 'hidden'>(unit ? 'loading' : 'hidden');
const layout = ref<{ style: string; format?: string } | null>(null);
let destroyed = false;
let resizeObserver: ResizeObserver | null = null;
let statusObserver: MutationObserver | null = null;

const reserveStyle = computed(() => (state.value === 'loading' && unit ? { minHeight: `${unit.height}px` } : undefined));

const setState = (next: AdState, visible = next === 'loading' || next === 'filled') => {
  state.value = visible ? next : 'hidden';
  emit('state', next);
};

const watchStatus = (element: HTMLElement) => {
  statusObserver = new MutationObserver(() => {
    const status = element.getAttribute('data-ad-status');
    if (status === 'filled') {
      setState('filled');
    } else if (status === 'unfilled') {
      setState('unfilled');
    }
  });
  statusObserver.observe(element, { attributes: true, attributeFilter: ['data-ad-status'] });
};

const load = () => {
  if (!unit || !root.value) {
    return;
  }
  const available = root.value.clientWidth;
  if (available >= unit.width) {
    layout.value = { style: `display:inline-block;width:${unit.width}px;height:${unit.height}px` };
  } else {
    // not enough room for the fixed size: let AdSense pick a size that fits the container
    // (full-width stretching is off so banners stay banner-shaped on phones)
    layout.value = { style: 'display:block;width:100%', format: unit.height <= 90 ? 'horizontal' : 'auto' };
  }
  nextTick(() => {
    if (destroyed || !ins.value) {
      return;
    }
    watchStatus(ins.value);
    if (!requestAd()) {
      setState('unfilled');
    }
  });
};

onMounted(async () => {
  if (!unit) {
    emit('state', 'unfilled');
    return;
  }
  const status = await whenAdsReady();
  if (destroyed) {
    return;
  }
  if (status === 'blocked') {
    setState('blocked');
    return;
  }
  if (root.value && root.value.clientWidth > 0) {
    load();
    return;
  }
  resizeObserver = new ResizeObserver(() => {
    if (root.value && root.value.clientWidth > 0) {
      resizeObserver?.disconnect();
      load();
    }
  });
  if (root.value) {
    resizeObserver.observe(root.value);
  }
});

onBeforeUnmount(() => {
  destroyed = true;
  resizeObserver?.disconnect();
  statusObserver?.disconnect();
});
</script>

<style>
.ad-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.ad-unit__label {
  color: var(--text-3);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
