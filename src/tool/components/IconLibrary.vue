<template>
  <UiModal :open="open" :title="t('tool.library.title')" icon="search" size="lg" @close="emit('close')">
    <div class="library">
      <div class="library__toolbar">
        <label class="library__search">
          <UiIcon name="search" />
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            class="library__input"
            :placeholder="set === 'brands' ? t('tool.library.searchBrands') : t('tool.library.searchIcons')"
            :aria-label="t('tool.library.search')"
          />
        </label>
        <UiSegmented v-model="set" :options="setOptions" :aria-label="t('tool.library.set')" />
      </div>

      <p class="field-hint library__count" role="status">
        <template v-if="error">{{ t('tool.gallery.offline') }}</template>
        <template v-else-if="loading && !items.length">{{ t('tool.library.loading') }}</template>
        <template v-else>{{ t('tool.library.count', { count: total }, total) }}</template>
      </p>

      <div class="library__grid" role="listbox" :aria-label="t('tool.library.results')">
        <button
          v-for="icon in items"
          :key="icon.id"
          type="button"
          class="library__item"
          :class="{ 'is-active': icon.id === selected }"
          role="option"
          :aria-selected="icon.id === selected ? 'true' : 'false'"
          :title="icon.name"
          @click="emit('pick', icon)"
        >
          <MdiIcon :path="icon.path" :style="icon.hex && set === 'brands' ? { color: icon.hex } : undefined" />
          <span class="library__name">{{ icon.name }}</span>
        </button>
        <div v-if="!loading && !error && !items.length" class="library__empty">
          <span class="library__emoji" aria-hidden="true">🫖</span>
          {{ t('tool.library.empty', { query }) }}
        </div>
      </div>

      <div v-if="items.length < total" class="library__more">
        <button type="button" class="btn" :disabled="loading" @click="load(true)">
          <UiIcon :name="loading ? 'loader' : 'chevron-down'" :class="{ spin: loading }" />
          <span>{{ t('tool.library.more') }}</span>
        </button>
      </div>

      <p v-if="set === 'brands'" class="field-hint">{{ t('tool.library.brandNote') }}</p>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import {
  computed, nextTick, ref, useTemplateRef, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiModal from '@/core/components/ui/UiModal.vue';
import UiSegmented from '@/core/components/ui/UiSegmented.vue';
import { searchIcons, type LibraryIcon } from '../api';
import MdiIcon from './MdiIcon.vue';

const PAGE = 72;

const props = defineProps<{ open: boolean; selected: string }>();
const emit = defineEmits<{ close: []; pick: [icon: LibraryIcon] }>();
const { t } = useI18n();

const query = ref('');
const set = ref<'icons' | 'brands'>('icons');
const items = ref<LibraryIcon[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref(false);
const searchInput = useTemplateRef<HTMLInputElement>('searchInput');
let request = 0;
let timer = 0;

const setOptions = computed(() => [
  { value: 'icons' as const, label: t('tool.setLibrary'), icon: 'shapes' },
  { value: 'brands' as const, label: t('tool.setBrands'), icon: 'tag' },
]);

const load = async (more = false) => {
  request += 1;
  const current = request;
  loading.value = true;
  error.value = false;
  try {
    const result = await searchIcons({
      q: query.value, set: set.value, offset: more ? items.value.length : 0, limit: PAGE,
    });
    if (current !== request) return;
    items.value = more ? [...items.value, ...result.items] : result.items;
    total.value = result.total;
  } catch {
    if (current === request) error.value = true;
  } finally {
    if (current === request) loading.value = false;
  }
};

watch([query, set], () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => load(), 180);
});

watch(() => props.open, (open) => {
  if (open) {
    if (!items.value.length) load();
    nextTick(() => searchInput.value?.focus());
  }
});
</script>

<style scoped>
.library {
  display: grid;
  gap: 10px;
}

.library__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.library__search {
  display: flex;
  flex: 1 1 260px;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-3);
}

.library__search:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.library__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
}

.library__count {
  margin: 0;
}

.library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 6px;
  max-height: min(52vh, 480px);
  padding: 2px;
  overflow-y: auto;
}

.library__item {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 6px;
  min-width: 0;
  height: 84px;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-size: 30px;
  transition: border-color var(--duration-fast) ease, background-color var(--duration-fast) ease, transform var(--duration-fast) ease;
}

.library__item:hover {
  border-color: var(--accent-soft-border);
  background: var(--accent-soft);
  transform: translateY(-2px);
}

.library__item.is-active {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.library__name {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-3);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library__empty {
  grid-column: 1 / -1;
  padding: 40px 12px;
  color: var(--text-3);
  text-align: center;
}

.library__emoji {
  display: block;
  margin-bottom: 6px;
  font-size: 32px;
}

.library__more {
  display: flex;
  justify-content: center;
}
</style>
