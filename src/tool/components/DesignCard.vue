<template>
  <article class="design-card" :class="{ 'is-compact': compact }">
    <button type="button" class="design-card__thumb" :aria-label="t('tool.gallery.openDetails', { title: design.title })" @click="emit('open')">
      <img :src="design.thumbnail" :alt="design.title" loading="lazy" width="512" height="512" />
      <span v-if="design.remixOf" class="design-card__badge"><UiIcon name="git-fork" />{{ t('tool.gallery.remix') }}</span>
    </button>
    <div class="design-card__body">
      <div class="design-card__text">
        <h3 class="design-card__title">{{ design.title }}</h3>
        <p class="design-card__author">{{ design.author || t('tool.gallery.anonymous') }}</p>
      </div>
      <button
        type="button"
        class="like-button"
        :class="{ 'is-liked': design.liked }"
        :aria-pressed="design.liked ? 'true' : 'false'"
        :aria-label="design.liked ? t('tool.gallery.unlike') : t('tool.gallery.like')"
        @click="emit('like')"
      >
        <UiIcon name="heart" />
        <span>{{ design.likes }}</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import type { GalleryDesign } from '../api';

defineProps<{ design: GalleryDesign; compact?: boolean }>();
const emit = defineEmits<{ open: []; like: [] }>();
const { t } = useI18n();
</script>

<style scoped>
.design-card {
  display: grid;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
  transition: transform 260ms var(--ease-spring), box-shadow var(--duration) ease, border-color var(--duration) ease;
}

.design-card:hover {
  border-color: var(--accent-soft-border);
  box-shadow: var(--shadow-md);
  transform: translateY(-3px) rotate(-0.4deg);
}

.design-card__thumb {
  position: relative;
  display: block;
  aspect-ratio: 1;
  padding: 12%;
  border: 0;
  background: radial-gradient(circle at 50% 40%, var(--surface) 0%, var(--surface-inset) 70%);
}

.design-card__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.18));
  transition: transform 500ms var(--ease-spring);
}

.design-card:hover .design-card__thumb img {
  transform: rotate(8deg) scale(1.04);
}

.design-card__badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--viewport-chrome);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
}

.design-card__badge .svg-icon {
  width: 12px;
  height: 12px;
}

.design-card__body {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 12px;
}

.design-card__text {
  flex: 1 1 auto;
  min-width: 0;
}

.design-card__title {
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.design-card__author {
  margin: 0;
  overflow: hidden;
  color: var(--text-3);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.like-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  transition: color var(--duration) ease, border-color var(--duration) ease, background-color var(--duration) ease;
}

.like-button:hover {
  border-color: var(--accent-soft-border);
  color: var(--accent-text);
}

.like-button .svg-icon {
  width: 15px;
  height: 15px;
}

.like-button.is-liked {
  border-color: var(--accent-soft-border);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.like-button.is-liked .svg-icon {
  fill: currentColor;
  animation: like-pop 420ms var(--ease-spring);
}

@keyframes like-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.is-compact .design-card__body {
  padding: 8px 10px 10px;
}
</style>
