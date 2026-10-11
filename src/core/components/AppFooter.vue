<template>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <img :src="siteConfig.logo" alt="" class="site-footer__logo" width="26" height="26" />
      <i18n-t keypath="footerCredits" tag="p" scope="global">
        <template #name><strong>{{ siteConfig.name }}</strong></template>
        <template #author>
          <a :href="siteConfig.author.url" rel="noopener" target="_blank">{{ siteConfig.author.name }}</a>
        </template>
        <template #license>
          <a href="https://opensource.org/licenses/MIT" rel="noopener nofollow" target="_blank">MIT</a>
        </template>
      </i18n-t>
      <i18n-t v-if="siteConfig.links.directory" keypath="partOfDirectory" tag="p" scope="global">
        <template #link>
          <a :href="siteConfig.links.directory" target="_blank" rel="noopener"><strong>{{ directoryName }}</strong></a>
        </template>
      </i18n-t>
      <div v-if="siteConfig.relatedTools.length" class="site-footer__related">
        <span>{{ t('alsoTry') }}</span>
        <a v-for="tool in siteConfig.relatedTools" :key="tool.url" class="related-tool" :href="tool.url" target="_blank" rel="noopener">
          <UiIcon :name="tool.icon" />
          {{ tool.name }}
        </a>
      </div>
      <p class="site-footer__links">
        <a v-if="siteConfig.links.repository" :href="siteConfig.links.repository" target="_blank" rel="noopener">
          <UiIcon name="github" /> {{ t('viewSource') }}
        </a>
        <a v-if="siteConfig.links.support" :href="siteConfig.links.support" target="_blank" rel="noopener">
          <UiIcon name="heart" /> {{ t('support') }}
        </a>
        <a v-if="siteConfig.links.contact" :href="siteConfig.links.contact">
          <UiIcon name="mail" /> {{ t('faqContact') }}
        </a>
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import siteConfig from '@/site.config';
import UiIcon from './ui/UiIcon.vue';

const { t } = useI18n();

const directoryName = siteConfig.links.directory ? new URL(siteConfig.links.directory).hostname : '';
</script>

<style>
.site-footer {
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.site-footer__inner {
  display: grid;
  justify-items: center;
  gap: 10px;
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 24px 48px;
  color: var(--text-3);
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}

.site-footer__inner p {
  margin: 0;
}

.site-footer__inner strong {
  color: var(--text-2);
}

.site-footer__inner a strong {
  color: inherit;
}

.site-footer__logo {
  width: 26px;
  height: 26px;
  margin-bottom: 8px;
  opacity: 0.85;
  object-fit: contain;
}

.site-footer__related {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.related-tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-inset);
  color: var(--text-2);
  font-weight: 500;
  transition: border-color var(--duration) ease, color var(--duration) ease, transform var(--duration-fast) ease;
}

.related-tool:hover {
  border-color: var(--accent-soft-border);
  color: var(--accent-text);
  text-decoration: none;
  transform: translateY(-1px);
}

.related-tool .svg-icon {
  width: 16px;
  height: 16px;
}

.site-footer__links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 18px;
}

.site-footer__links a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
