<template>
  <UiPopover placement="bottom-end" :width="220">
    <template #trigger="{ toggle, open }">
      <button
        type="button"
        class="btn btn--ghost language-button"
        :class="{ 'is-open': open }"
        aria-haspopup="menu"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-label="t('changeLanguage')"
        :data-tip="open ? '' : t('changeLanguage')"
        data-tip-pos="bottom"
        @click="toggle"
      >
        <img class="language-flag" :src="`/flags/${locale}.gif`" alt="" />
        <UiIcon name="chevron-down" class="language-button__chevron" />
      </button>
    </template>
    <div class="menu-heading">{{ t('changeLanguage') }}</div>
    <!-- real links, so crawlers find every language version -->
    <a
      v-for="item in locales"
      :key="item"
      class="menu-item"
      :class="{ 'is-active': item === locale }"
      :href="localePath(item)"
      :hreflang="item"
      @click.prevent="setLocale(item)"
    >
      <img class="language-flag" :src="`/flags/${item}.gif`" alt="" />
      <span class="menu-item__label">{{ t('languageLocalName', {}, { locale: item }) }}</span>
      <UiIcon v-if="item === locale" name="check" />
    </a>
  </UiPopover>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { localePath, locales, setLocale } from '../i18n';
import UiIcon from './ui/UiIcon.vue';
import UiPopover from './ui/UiPopover.vue';

const { t, locale } = useI18n();
</script>

<style>
.language-button {
  gap: 6px;
  height: 42px;
  padding: 0 8px 0 10px;
}

.language-button.is-open {
  background: var(--surface-hover);
}

.language-button__chevron {
  width: 15px !important;
  height: 15px !important;
  color: var(--text-3);
}

.language-flag {
  width: 22px;
  height: 15px;
  border-radius: 3px;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
}
</style>
