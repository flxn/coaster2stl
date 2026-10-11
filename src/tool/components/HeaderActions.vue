<template>
  <button type="button" class="btn header-btn gallery-button" :data-tip="t('tool.gallery.tip')" data-tip-pos="bottom" @click="openGallery">
    <UiIcon name="layout-grid" />
    <span class="header-btn__label">{{ t('tool.gallery.button') }}</span>
  </button>
  <button type="button" class="btn btn--primary header-btn" :data-tip="t('tool.share.tip')" data-tip-pos="bottom" @click="coasterState.shareOpen = true">
    <UiIcon name="send" />
    <span class="header-btn__label">{{ t('tool.share.button') }}</span>
  </button>
  <GalleryModal />
  <ShareModal />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import { coasterState, sharedDesignId, useDesignLoader } from '../state';
import GalleryModal from './GalleryModal.vue';
import ShareModal from './ShareModal.vue';

const { t } = useI18n();
const { loadDesign } = useDesignLoader();

const openGallery = () => {
  coasterState.detailId = null;
  coasterState.galleryOpen = true;
};

onMounted(() => {
  // opened through a share link (/d/<id>): show that design
  const id = sharedDesignId();
  if (id) {
    loadDesign(id);
  }
});
</script>

<style scoped>
.gallery-button {
  border-color: var(--accent-soft-border);
  color: var(--accent-text);
}
</style>
