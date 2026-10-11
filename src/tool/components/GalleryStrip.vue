<template>
  <section v-if="state !== 'hidden'" class="info-section gallery-strip" aria-labelledby="gallery-strip-title">
    <header class="info-section__header gallery-strip__header">
      <span class="info-section__icon"><UiIcon name="layout-grid" /></span>
      <div>
        <h2 id="gallery-strip-title" class="info-section__title">{{ t('tool.strip.title') }}</h2>
        <p class="info-section__subtitle">{{ t('tool.strip.subtitle') }}</p>
      </div>
      <span class="gallery-strip__spacer"></span>
      <button type="button" class="btn" @click="openGallery(null)">
        <span>{{ t('tool.strip.all') }}</span><UiIcon name="chevron-right" />
      </button>
    </header>
    <div v-if="state === 'empty'" class="gallery-strip__empty">
      <span class="gallery-strip__emoji" aria-hidden="true">☕</span>
      <p>{{ t('tool.strip.empty') }}</p>
      <button type="button" class="btn btn--primary" @click="coasterState.shareOpen = true">
        <UiIcon name="send" /><span>{{ t('tool.gallery.shareYours') }}</span>
      </button>
    </div>
    <div v-else class="gallery-strip__grid">
      <DesignCard
        v-for="design in items"
        :key="design.id"
        :design="design"
        compact
        @open="openGallery(design.id)"
        @like="toggleLike(design, t('tool.gallery.likeFailed'))"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import { listDesigns, type GalleryDesign } from '../api';
import { coasterState, toggleLike } from '../state';
import DesignCard from './DesignCard.vue';

const { t } = useI18n();
const items = ref<GalleryDesign[]>([]);
/** hidden while loading and when the gallery is unreachable (e.g. a static deployment) */
const state = ref<'hidden' | 'empty' | 'ready'>('hidden');

const load = async () => {
  try {
    const result = await listDesigns({ sort: 'trending', limit: 6 });
    items.value = result.items;
    state.value = result.items.length ? 'ready' : 'empty';
  } catch {
    state.value = 'hidden';
  }
};

const openGallery = (id: string | null) => {
  coasterState.detailId = id;
  coasterState.galleryOpen = true;
};

onMounted(load);
watch(() => coasterState.galleryVersion, load);
</script>

<style scoped>
.gallery-strip__header {
  flex-wrap: wrap;
}

.gallery-strip__spacer {
  flex: 1 1 auto;
}

.gallery-strip__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.gallery-strip__empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 16px;
  color: var(--text-2);
  text-align: center;
}

.gallery-strip__emoji {
  font-size: 38px;
}

.gallery-strip__empty p {
  max-width: 460px;
  margin: 0 0 6px;
}
</style>
