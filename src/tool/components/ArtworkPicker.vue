<template>
  <div class="artwork-picker">
    <UiSegmented v-model="artwork.source" block :options="sourceOptions" :aria-label="t('tool.artwork')" />

    <template v-if="artwork.source === 'icon'">
      <div class="artwork-current">
        <span class="artwork-current__icon">
          <MdiIcon v-if="artwork.icon" :path="artwork.icon.path" />
        </span>
        <span class="artwork-current__text">
          <span class="artwork-current__name">{{ artwork.icon?.name ?? t('tool.noIcon') }}</span>
          <span class="artwork-current__hint">{{ iconSetLabel }}</span>
        </span>
        <button type="button" class="btn btn--sm btn--accent-outline" @click="libraryOpen = true">
          <UiIcon name="search" />
          <span>{{ t('tool.browseLibrary') }}</span>
        </button>
      </div>
      <div class="quick-grid" role="radiogroup" :aria-label="t('tool.quickPicks')">
        <button
          v-for="(icon, id) in QUICK_ICONS"
          :key="id"
          type="button"
          class="quick-grid__item"
          :class="{ 'is-active': artwork.icon?.id === `quick:${id}` }"
          role="radio"
          :aria-checked="artwork.icon?.id === `quick:${id}` ? 'true' : 'false'"
          :aria-label="icon.name"
          :title="icon.name"
          @click="pick({ id: `quick:${id}`, name: icon.name, path: icon.path })"
        >
          <MdiIcon :path="icon.path" />
        </button>
      </div>
    </template>

    <UploadArtwork v-else-if="artwork.source === 'upload'" v-model="artwork.upload" />

    <IconLibrary :open="libraryOpen" :selected="artwork.icon?.id ?? ''" @close="libraryOpen = false" @pick="onLibraryPick" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiSegmented from '@/core/components/ui/UiSegmented.vue';
import type { LibraryIcon } from '../api';
import { QUICK_ICONS } from '../catalog';
import type { IconChoice, ToolOptions } from '../options';
import IconLibrary from './IconLibrary.vue';
import MdiIcon from './MdiIcon.vue';
import UploadArtwork from './UploadArtwork.vue';

const artwork = defineModel<ToolOptions['artwork']>({ required: true });
const emit = defineEmits<{ 'brand-color': [hex: string] }>();
const { t } = useI18n();
const libraryOpen = ref(false);

const sourceOptions = computed(() => [
  { value: 'none' as const, label: t('tool.artworkNone') },
  { value: 'icon' as const, label: t('tool.artworkIcon') },
  { value: 'upload' as const, label: t('tool.artworkUpload') },
]);

const iconSetLabel = computed(() => {
  const id = artwork.value.icon?.id ?? '';
  if (id.startsWith('brands:')) return t('tool.setBrands');
  if (id.startsWith('mdi:')) return t('tool.setLibrary');
  return t('tool.setQuick');
});

const pick = (icon: IconChoice) => {
  artwork.value.icon = icon;
  artwork.value.source = 'icon';
};

const onLibraryPick = (icon: LibraryIcon) => {
  pick({ id: icon.id, name: icon.name, path: icon.path });
  libraryOpen.value = false;
  if (icon.hex) {
    emit('brand-color', icon.hex);
  }
};
</script>

<style scoped>
.artwork-picker {
  display: grid;
  gap: 10px;
}

.artwork-current {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-inset);
}

.artwork-current__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--accent);
  font-size: 26px;
  box-shadow: var(--shadow-xs);
}

.artwork-current__text {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
}

.artwork-current__name {
  overflow: hidden;
  color: var(--text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artwork-current__hint {
  color: var(--text-3);
  font-size: 12px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 3px;
  max-height: 152px;
  padding: 5px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.quick-grid__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-2);
  font-size: 18px;
  transition: background-color var(--duration-fast) ease, color var(--duration-fast) ease, transform var(--duration-fast) ease;
}

.quick-grid__item:hover {
  background: var(--surface-hover);
  color: var(--text);
  transform: scale(1.12);
}

.quick-grid__item.is-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}
</style>
