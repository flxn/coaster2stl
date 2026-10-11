<template>
  <div class="upload">
    <label
      class="file-drop"
      :class="{ 'is-dragover': dragover }"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" @change="onFile" />
      <span class="file-drop__icon">
        <svg v-if="model" class="upload__preview" :viewBox="`0 0 ${model.width} ${model.height}`" aria-hidden="true">
          <path :d="previewPath" fill="currentColor" fill-rule="evenodd" />
        </svg>
        <UiIcon v-else name="upload" />
      </span>
      <span class="file-drop__text">
        <span class="file-drop__title">{{ model ? model.name : t('tool.uploadTitle') }}</span>
        <span>{{ model ? t('tool.uploadReplace') : t('tool.uploadHint') }}</span>
      </span>
    </label>

    <div v-if="image" class="subgroup">
      <p class="field-hint">{{ t('tool.traceHelp') }}</p>
      <UiSlider
        v-model="trace.threshold"
        :label="t('tool.traceThreshold')"
        :min="10"
        :max="245"
        :step="5"
        :reset-to="suggested"
        :reset-label="t('tool.traceAuto')"
      />
      <UiField :label="t('tool.traceInvert')" :help="t('tool.traceInvertHelp')">
        <UiToggle v-model="trace.invert" :aria-label="t('tool.traceInvert')" />
      </UiField>
    </div>
    <p v-else class="field-hint">{{ t('tool.uploadFormats') }}</p>
  </div>
</template>

<script setup lang="ts">
import {
  computed, reactive, ref, shallowRef, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import UiField from '@/core/components/ui/UiField.vue';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiSlider from '@/core/components/ui/UiSlider.vue';
import UiToggle from '@/core/components/ui/UiToggle.vue';
import { toast } from '@/core/composables/useToasts';
import {
  ArtworkError, loadImage, parseSvg, suggestThreshold, traceImage,
} from '../artwork';
import type { UploadedArtwork } from '../options';

const model = defineModel<UploadedArtwork | null>({ required: true });
const { t } = useI18n();
const dragover = ref(false);
/** the last uploaded image (not saved), so the tracing can be adjusted */
const image = shallowRef<{ data: ImageData; name: string } | null>(null);
const suggested = ref(128);
const trace = reactive({ threshold: 128, invert: false });
let traceTimer = 0;

const previewPath = computed(() => (model.value?.polygons ?? []).map((polygon) => [polygon.outer, ...polygon.holes]
  .map((ring) => `M${ring.join(' ')}Z`).join('')).join(''));

const fail = (error: unknown) => {
  const code = error instanceof ArtworkError ? error.message : 'invalid';
  toast({ type: 'error', message: t(`tool.uploadErrors.${['empty', 'noShapes', 'tooComplex'].includes(code) ? code : 'invalid'}`) });
};

const runTrace = () => {
  if (!image.value) return;
  try {
    model.value = traceImage(image.value.data, trace, image.value.name);
  } catch (error) {
    fail(error);
  }
};

watch(trace, () => {
  window.clearTimeout(traceTimer);
  traceTimer = window.setTimeout(runTrace, 150);
});

const load = async (file: File | undefined) => {
  if (!file) return;
  try {
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      image.value = null;
      model.value = parseSvg(await file.text(), file.name);
    } else {
      const data = await loadImage(file);
      image.value = { data, name: file.name };
      suggested.value = suggestThreshold(data);
      trace.invert = false;
      trace.threshold = suggested.value;
      // the watcher only runs on changes, so trace right away
      runTrace();
    }
    toast({ type: 'success', message: t('tool.uploadLoaded') });
  } catch (error) {
    fail(error);
  }
};

const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement;
  load(input.files?.[0]);
  input.value = '';
};

const onDrop = (event: DragEvent) => {
  dragover.value = false;
  load(event.dataTransfer?.files[0]);
};
</script>

<style scoped>
.upload {
  display: grid;
  gap: 10px;
}

.upload__preview {
  width: 26px;
  height: 26px;
}
</style>
