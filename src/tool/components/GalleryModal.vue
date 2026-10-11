<template>
  <UiModal
    :open="coasterState.galleryOpen"
    :title="detail ? detail.title : t('tool.gallery.title')"
    :subtitle="detail ? '' : t('tool.gallery.subtitle')"
    icon="layout-grid"
    size="xl"
    @close="close"
  >
    <template v-if="detail" #header-extra>
      <button type="button" class="btn btn--sm btn--ghost" @click="backToList">
        <UiIcon name="arrow-left" /><span>{{ t('tool.gallery.back') }}</span>
      </button>
    </template>

    <!-- detail -->
    <div v-if="detail" class="gallery-detail">
      <div class="gallery-detail__thumb">
        <img :src="detail.thumbnail" :alt="detail.title" width="512" height="512" />
      </div>
      <div class="gallery-detail__info">
        <p class="gallery-detail__author">
          <UiIcon name="user" />
          {{ detail.author || t('tool.gallery.anonymous') }}
          <span class="gallery-detail__date">· {{ formatDate(detail.createdAt) }}</span>
        </p>
        <div class="gallery-detail__stats">
          <span><UiIcon name="heart" /> {{ t('tool.gallery.likes', { count: detail.likes }, detail.likes) }}</span>
          <span><UiIcon name="printer" /> {{ t('tool.gallery.prints', { count: detail.downloads }, detail.downloads) }}</span>
        </div>
        <div v-if="detail.tags.length" class="gallery-tags">
          <button v-for="tag in detail.tags" :key="tag" type="button" class="gallery-tag" @click="searchTag(tag)">#{{ tag }}</button>
        </div>
        <p v-if="detail.remixOf" class="field-hint">
          <UiIcon name="git-fork" />
          {{ t('tool.gallery.remixOf') }}
          <button type="button" class="link-button" @click="openDetail(detail.remixOf)">{{ t('tool.gallery.original') }}</button>
        </p>

        <div class="gallery-detail__actions">
          <button type="button" class="btn btn--lg btn--primary" @click="openInEditor(detail.id)">
            <UiIcon name="pencil" /><span>{{ t('tool.gallery.openInEditor') }}</span>
          </button>
          <button
            type="button"
            class="btn btn--lg"
            :class="{ 'btn--accent-outline': detail.liked }"
            @click="toggleLike(detail, t('tool.gallery.likeFailed'))"
          >
            <UiIcon name="heart" :class="{ 'is-filled': detail.liked }" />
            <span>{{ detail.liked ? t('tool.gallery.liked') : t('tool.gallery.like') }}</span>
          </button>
          <button type="button" class="btn btn--lg" @click="copyLink(detail.id)">
            <UiIcon name="link" /><span>{{ t('tool.gallery.copyLink') }}</span>
          </button>
        </div>
        <div class="gallery-detail__secondary">
          <button v-if="ownsDesign(detail.id)" type="button" class="btn btn--sm btn--danger" @click="remove(detail.id)">
            <UiIcon name="trash" /><span>{{ t('tool.gallery.delete') }}</span>
          </button>
          <button v-else type="button" class="btn btn--sm btn--ghost" :disabled="reported.has(detail.id)" @click="report(detail.id)">
            <UiIcon name="flag" /><span>{{ reported.has(detail.id) ? t('tool.gallery.reported') : t('tool.gallery.report') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- list -->
    <div v-else class="gallery">
      <div class="gallery__toolbar">
        <label class="gallery__search">
          <UiIcon name="search" />
          <input v-model="query" type="search" :placeholder="t('tool.gallery.search')" :aria-label="t('tool.gallery.search')" />
        </label>
        <UiSegmented v-model="sort" :options="sortOptions" :aria-label="t('tool.gallery.sort')" />
      </div>

      <div v-if="error" class="gallery__empty">
        <span class="gallery__emoji" aria-hidden="true">🔌</span>
        <p>{{ t('tool.gallery.offline') }}</p>
        <button type="button" class="btn" @click="load()">{{ t('tool.gallery.retry') }}</button>
      </div>
      <div v-else-if="!loading && !items.length" class="gallery__empty">
        <span class="gallery__emoji" aria-hidden="true">{{ sort === 'mine' ? '🎨' : '☕' }}</span>
        <p>{{ query ? t('tool.gallery.noResults', { query }) : sort === 'mine' ? t('tool.gallery.noneMine') : t('tool.gallery.empty') }}</p>
        <button type="button" class="btn btn--primary" @click="share">
          <UiIcon name="send" /><span>{{ t('tool.gallery.shareYours') }}</span>
        </button>
      </div>
      <div v-else class="gallery__grid">
        <DesignCard
          v-for="design in items"
          :key="design.id"
          :design="design"
          @open="openDetail(design.id)"
          @like="toggleLike(design, t('tool.gallery.likeFailed'))"
        />
        <div v-for="n in loading && !items.length ? 8 : 0" :key="`skeleton-${n}`" class="gallery__skeleton"></div>
      </div>

      <div v-if="items.length < total" class="gallery__more">
        <button type="button" class="btn" :disabled="loading" @click="load(true)">
          <UiIcon :name="loading ? 'loader' : 'chevron-down'" :class="{ spin: loading }" />
          <span>{{ t('tool.gallery.more') }}</span>
        </button>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiModal from '@/core/components/ui/UiModal.vue';
import UiSegmented from '@/core/components/ui/UiSegmented.vue';
import { toast } from '@/core/composables/useToasts';
import {
  deleteDesign, designUrl, getDesign, listDesigns, ownsDesign, reportDesign,
  type GalleryDesign, type GalleryDesignDetail,
} from '../api';
import { coasterState, toggleLike, useDesignLoader } from '../state';
import DesignCard from './DesignCard.vue';

type Sort = 'trending' | 'top' | 'new' | 'mine';

const { t, locale } = useI18n();
const { loadDesign } = useDesignLoader();

const query = ref('');
const sort = ref<Sort>('trending');
const items = ref<GalleryDesign[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref(false);
const detail = ref<GalleryDesignDetail | null>(null);
const reported = ref(new Set<string>());
let request = 0;
let searchTimer = 0;

const sortOptions = computed(() => [
  { value: 'trending' as const, label: t('tool.gallery.sorts.trending'), icon: 'trending-up' },
  { value: 'top' as const, label: t('tool.gallery.sorts.top'), icon: 'trophy' },
  { value: 'new' as const, label: t('tool.gallery.sorts.new'), icon: 'clock' },
  { value: 'mine' as const, label: t('tool.gallery.sorts.mine'), icon: 'user' },
]);

const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' });

const load = async (more = false) => {
  request += 1;
  const current = request;
  loading.value = true;
  error.value = false;
  try {
    const result = await listDesigns({
      q: query.value,
      sort: sort.value === 'mine' ? 'new' : sort.value,
      mine: sort.value === 'mine',
      offset: more ? items.value.length : 0,
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

const openDetail = async (id: string) => {
  coasterState.detailId = id;
  try {
    detail.value = await getDesign(id);
  } catch {
    toast({ type: 'error', message: t('tool.gallery.notFound') });
    coasterState.detailId = null;
  }
};

const backToList = () => {
  detail.value = null;
  coasterState.detailId = null;
};

const close = () => {
  coasterState.galleryOpen = false;
  backToList();
};

const openInEditor = async (id: string) => {
  if (await loadDesign(id)) {
    close();
  }
};

const searchTag = (tag: string) => {
  backToList();
  query.value = tag;
};

const copyLink = async (id: string) => {
  await navigator.clipboard.writeText(designUrl(id));
  toast({ type: 'success', icon: 'link', message: t('tool.gallery.linkCopied') });
};

const report = async (id: string) => {
  try {
    await reportDesign(id, '');
    reported.value = new Set([...reported.value, id]);
    toast({ type: 'info', icon: 'flag', message: t('tool.gallery.reportThanks') });
  } catch {
    toast({ type: 'error', message: t('tool.gallery.offline') });
  }
};

const remove = async (id: string) => {
  if (!window.confirm(t('tool.gallery.deleteConfirm'))) return;
  try {
    await deleteDesign(id);
    toast({ type: 'success', icon: 'trash', message: t('tool.gallery.deleted') });
    backToList();
    coasterState.galleryVersion += 1;
  } catch {
    toast({ type: 'error', message: t('tool.gallery.offline') });
  }
};

const share = () => {
  close();
  coasterState.shareOpen = true;
};

watch(sort, () => load());
watch(query, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => load(), 250);
});
watch(() => coasterState.galleryOpen, (open) => {
  if (open) {
    load();
    if (coasterState.detailId) openDetail(coasterState.detailId);
  }
});
watch(() => coasterState.galleryVersion, () => {
  if (coasterState.galleryOpen) load();
});
</script>

<style scoped>
.gallery {
  display: grid;
  gap: 16px;
}

.gallery__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.gallery__search {
  display: flex;
  flex: 1 1 240px;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-3);
}

.gallery__search:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.gallery__search input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
}

.gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px;
}

.gallery__skeleton {
  aspect-ratio: 0.82;
  border-radius: var(--radius-lg);
  background: linear-gradient(100deg, var(--surface-inset) 30%, var(--surface-hover) 50%, var(--surface-inset) 70%) 0 0 / 300% 100%;
  animation: skeleton 1.2s linear infinite;
}

@keyframes skeleton {
  to { background-position: -150% 0; }
}

.gallery__empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 48px 16px;
  color: var(--text-2);
  text-align: center;
}

.gallery__emoji {
  font-size: 44px;
  animation: empty-wobble 3s ease-in-out infinite;
}

@keyframes empty-wobble {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg) translateY(-4px); }
}

.gallery__empty p {
  max-width: 420px;
  margin: 0 0 8px;
}

.gallery__more {
  display: flex;
  justify-content: center;
}

.gallery-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px;
  align-items: center;
}

.gallery-detail__thumb {
  aspect-ratio: 1;
  padding: 10%;
  border-radius: var(--radius-xl);
  background: radial-gradient(circle at 50% 40%, var(--surface) 0%, var(--surface-inset) 75%);
}

.gallery-detail__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.2));
}

.gallery-detail__info {
  display: grid;
  gap: 14px;
}

.gallery-detail__author {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
}

.gallery-detail__date {
  color: var(--text-3);
  font-weight: 400;
}

.gallery-detail__stats {
  display: flex;
  gap: 16px;
  color: var(--text-2);
}

.gallery-detail__stats span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gallery-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gallery-tag {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-inset);
  color: var(--text-2);
  font-size: 12.5px;
}

.gallery-tag:hover {
  border-color: var(--accent-soft-border);
  color: var(--accent-text);
}

.gallery-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gallery-detail__secondary {
  display: flex;
  gap: 8px;
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-text);
  text-decoration: underline;
}

.is-filled {
  fill: currentColor;
}

@media (max-width: 760px) {
  .gallery-detail {
    grid-template-columns: 1fr;
  }
}
</style>
