<template>
  <UiModal :open="coasterState.shareOpen" :title="published ? t('tool.share.doneTitle') : t('tool.share.title')" icon="send" size="md" @close="close">
    <div v-if="published" class="share-done">
      <div class="share-done__thumb">
        <img :src="published.thumbnail" :alt="published.title" />
        <span class="share-done__confetti" aria-hidden="true">🎉</span>
      </div>
      <p>{{ t('tool.share.doneText', { title: published.title }) }}</p>
      <div class="share-done__link">
        <input class="input" readonly :value="designUrl(published.id)" :aria-label="t('tool.share.link')" @focus="($event.target as HTMLInputElement).select()" />
        <button type="button" class="btn btn--primary" @click="copy">
          <UiIcon :name="copied ? 'check' : 'copy'" /><span>{{ copied ? t('tool.share.copied') : t('tool.share.copy') }}</span>
        </button>
      </div>
    </div>

    <form v-else id="share-form" class="share" @submit.prevent="publish">
      <div class="share__preview" :class="{ 'is-loading': !thumbnail }">
        <img v-if="thumbnail" :src="thumbnail" alt="" />
        <UiIcon v-else name="loader" class="spin" />
      </div>
      <div class="share__fields">
        <p v-if="coasterState.loaded" class="notice notice--info share__remix">
          <UiIcon name="git-fork" />
          <span>{{ t('tool.share.remixNote', { title: coasterState.loaded.title }) }}</span>
        </p>
        <label class="field-stack">
          <span class="field-label">{{ t('tool.share.name') }}</span>
          <input v-model="title" class="input" required minlength="2" maxlength="60" :placeholder="t('tool.share.namePlaceholder')" />
        </label>
        <label class="field-stack">
          <span class="field-label">{{ t('tool.share.author') }}</span>
          <input v-model="author" class="input" maxlength="40" :placeholder="t('tool.share.authorPlaceholder')" />
        </label>
        <label class="field-stack">
          <span class="field-label">{{ t('tool.share.tags') }}</span>
          <input v-model="tags" class="input" maxlength="200" :placeholder="t('tool.share.tagsPlaceholder')" />
        </label>
        <p class="field-hint">{{ t('tool.share.license') }}</p>
        <p v-if="error" class="notice notice--danger"><UiIcon name="alert" /><span>{{ error }}</span></p>
      </div>
    </form>

    <template #footer>
      <template v-if="published">
        <button type="button" class="btn" @click="openGallery">
          <UiIcon name="layout-grid" /><span>{{ t('tool.share.toGallery') }}</span>
        </button>
        <button type="button" class="btn btn--primary" @click="close">{{ t('close') }}</button>
      </template>
      <template v-else>
        <button type="button" class="btn" @click="close">{{ t('tool.share.cancel') }}</button>
        <button type="submit" form="share-form" class="btn btn--primary" :disabled="busy || !thumbnail || title.trim().length < 2">
          <UiIcon :name="busy ? 'loader' : 'send'" :class="{ spin: busy }" />
          <span>{{ t('tool.share.publish') }}</span>
        </button>
      </template>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiModal from '@/core/components/ui/UiModal.vue';
import { toast } from '@/core/composables/useToasts';
import { useWorkbench } from '@/core/composables/useWorkbench';
import {
  ApiError, designUrl, publishDesign, rememberedAuthor, type GalleryDesign,
} from '../api';
import type { ToolOptions } from '../options';
import { coasterState } from '../state';

const { t } = useI18n();
const workbench = useWorkbench();

const title = ref('');
const author = ref(rememberedAuthor());
const tags = ref('');
const thumbnail = ref('');
const busy = ref(false);
const error = ref('');
const published = ref<GalleryDesign | null>(null);
const copied = ref(false);

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** Waits until the preview shows the current settings (generating them if needed). */
const freshModel = () => new Promise<void>((resolve) => {
  if (!workbench.isStale.value && workbench.hasModel.value && !workbench.isGenerating.value) {
    resolve();
    return;
  }
  if (!workbench.isGenerating.value) {
    workbench.generate();
  }
  const stop = watch(() => [workbench.isGenerating.value, workbench.isStale.value], () => {
    if (!workbench.isGenerating.value && !workbench.isStale.value && workbench.hasModel.value) {
      stop();
      resolve();
    }
  });
});

const renderThumbnail = async () => {
  thumbnail.value = '';
  await freshModel();
  const options = workbench.options as ToolOptions;
  const faceDown = options.print.relief !== 'raised' && options.print.faceDown;
  const blob = await workbench.preview.value!.renderPNG({
    maxSide: 512, fromBelow: faceDown, type: 'image/webp', quality: 0.86,
  });
  thumbnail.value = await blobToDataUrl(blob);
};

const errorMessage = (code: string) => {
  const known = ['rate_limited', 'title_required', 'design_too_large', 'offline'];
  return t(`tool.share.errors.${known.includes(code) ? code : 'generic'}`);
};

const publish = async () => {
  busy.value = true;
  error.value = '';
  try {
    const design = await publishDesign({
      title: title.value.trim(),
      author: author.value.trim(),
      tags: tags.value,
      options: workbench.exportOptions() as ToolOptions,
      thumbnail: thumbnail.value,
      remixOf: coasterState.loaded?.id ?? null,
    });
    published.value = design;
    coasterState.loaded = { id: design.id, title: design.title, author: design.author, signature: JSON.stringify(workbench.exportOptions()) };
    coasterState.galleryVersion += 1;
  } catch (cause) {
    error.value = errorMessage(cause instanceof ApiError ? cause.code : 'generic');
  } finally {
    busy.value = false;
  }
};

const copy = async () => {
  if (!published.value) return;
  await navigator.clipboard.writeText(designUrl(published.value.id));
  copied.value = true;
  toast({ type: 'success', icon: 'link', message: t('tool.gallery.linkCopied') });
};

const close = () => {
  coasterState.shareOpen = false;
};

const openGallery = () => {
  const id = published.value?.id ?? null;
  close();
  coasterState.detailId = id;
  coasterState.galleryOpen = true;
};

watch(() => coasterState.shareOpen, (open) => {
  if (!open) return;
  published.value = null;
  copied.value = false;
  error.value = '';
  title.value = coasterState.loaded ? t('tool.share.remixTitle', { title: coasterState.loaded.title }).slice(0, 60) : '';
  renderThumbnail().catch(() => {
    error.value = t('tool.share.errors.render');
  });
});
</script>

<style scoped>
.share {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.share__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  padding: 10%;
  border-radius: var(--radius-lg);
  background: radial-gradient(circle at 50% 40%, var(--surface) 0%, var(--surface-inset) 75%);
  color: var(--text-3);
}

.share__preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.2));
  animation: share-in 600ms var(--ease-spring);
}

@keyframes share-in {
  from { opacity: 0; transform: rotate(-30deg) scale(0.6); }
}

.share__fields {
  display: grid;
  gap: 12px;
}

.share__remix {
  margin: 0;
}

.share-done {
  display: grid;
  justify-items: center;
  gap: 14px;
  text-align: center;
}

.share-done__thumb {
  position: relative;
  width: 180px;
  height: 180px;
}

.share-done__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  animation: share-in 700ms var(--ease-spring);
}

.share-done__confetti {
  position: absolute;
  top: -6px;
  right: -14px;
  font-size: 34px;
  animation: confetti 900ms var(--ease-spring);
}

@keyframes confetti {
  from { opacity: 0; transform: scale(0.2) rotate(-40deg); }
}

.share-done p {
  margin: 0;
  color: var(--text-2);
}

.share-done__link {
  display: flex;
  gap: 8px;
  width: 100%;
}

@media (max-width: 640px) {
  .share {
    grid-template-columns: 1fr;
  }
}
</style>
