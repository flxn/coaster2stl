<template>
  <div class="info-area">
    <div v-if="showAds" class="ad-row">
      <AdSlot name="model" label />
      <AdSlot v-if="!headerAdInHeader" name="header" label />
    </div>

    <slot name="before" />

    <ToolPromotions />

    <nav class="info-nav" :aria-label="t('infoNavigation')">
      <a class="info-nav__link" href="#printguide">
        <UiIcon name="book-open" />
        <span>{{ t('printGuide.title') }}</span>
      </a>
      <a class="info-nav__link" href="#faq">
        <UiIcon name="help" />
        <span>{{ t('faqTitle') }}</span>
      </a>
      <a class="info-nav__link" href="#changelog">
        <UiIcon name="scroll-text" />
        <span>{{ t('changelog') }}</span>
      </a>
    </nav>

    <section id="printguide" class="info-section">
      <header class="info-section__header">
        <span class="info-section__icon"><UiIcon name="book-open" /></span>
        <div>
          <h2 class="info-section__title">{{ t('printGuide.title') }}</h2>
          <p class="info-section__subtitle">{{ t('printGuide.subtitle') }}</p>
        </div>
      </header>
      <div class="prose print-guide">
        <p>{{ t('printGuide.intro') }}</p>
        <div class="notice notice--warning">
          <UiIcon name="alert" />
          <div>
            <strong>{{ t('printGuide.warningTitle') }}</strong><br />
            {{ t('printGuide.warningText') }}
          </div>
        </div>
        <ol>
          <li v-for="(step, index) in tm('printGuide.steps')" :key="index">{{ rt(step) }}</li>
        </ol>
        <p>{{ t('printGuide.multiMaterial') }}</p>
      </div>
    </section>

    <section id="faq" class="info-section">
      <header class="info-section__header">
        <span class="info-section__icon"><UiIcon name="help" /></span>
        <div>
          <h2 class="info-section__title">{{ t('faqTitle') }}</h2>
        </div>
      </header>
      <div class="faq-list">
        <div v-for="(entry, index) in faq" :key="entry.question" class="faq-item" :class="{ 'is-open': openFaq.has(index) }">
          <h3 class="faq-item__heading">
            <button
              :id="`faq-question-${index}`"
              type="button"
              class="faq-item__question"
              :aria-expanded="openFaq.has(index) ? 'true' : 'false'"
              :aria-controls="`faq-answer-${index}`"
              @click="toggleFaq(index)"
            >
              <span>{{ t(entry.question) }}</span>
              <span class="faq-item__icon" aria-hidden="true"><UiIcon name="plus" /></span>
            </button>
          </h3>
          <div :id="`faq-answer-${index}`" class="faq-item__answer" role="region" :aria-labelledby="`faq-question-${index}`">
            <div class="faq-item__answer-inner">
              <p class="prose">{{ t(entry.answer) }}</p>
            </div>
          </div>
        </div>
      </div>
      <p v-if="siteConfig.links.contact" class="faq-footer">
        {{ t('faqFooter') }}
        <a :href="siteConfig.links.contact">{{ t('faqContact') }}</a>
      </p>
    </section>

    <section id="changelog" class="info-section">
      <header class="info-section__header">
        <span class="info-section__icon"><UiIcon name="scroll-text" /></span>
        <div>
          <h2 class="info-section__title">{{ t('changelog') }}</h2>
          <p class="info-section__subtitle">v{{ appVersion }}</p>
        </div>
      </header>
      <div class="changelog-body" :class="{ 'is-collapsed': hasMoreEntries && !changelogExpanded }">
        <!-- eslint-disable-next-line vue/no-v-html -- CHANGELOG.md from this repository -->
        <div class="prose" v-html="changelogHtml"></div>
      </div>
      <div v-if="hasMoreEntries" class="changelog-toggle">
        <button type="button" class="btn" @click="changelogExpanded = !changelogExpanded">
          <UiIcon :name="changelogExpanded ? 'chevron-up' : 'chevron-down'" />
          <span>{{ changelogExpanded ? t('showLess') : t('showFullChangelog') }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import changelog from '../../../CHANGELOG.md?raw';
import siteConfig from '@/site.config';
import type { FaqEntry } from '../tool';
import AdSlot from './AdSlot.vue';
import ToolPromotions from './ToolPromotions.vue';
import UiIcon from './ui/UiIcon.vue';

defineProps<{
  faq: FaqEntry[];
  showAds: boolean;
  /** the 468×60 unit is shown in the header on wide screens, otherwise here */
  headerAdInHeader: boolean;
}>();

const VISIBLE_ENTRIES = 3;

const { t, tm, rt } = useI18n();
const appVersion = __APP_VERSION__;
const markdown = new MarkdownIt({ linkify: true, typographer: true });

// drop the "# Changelog" title and intro, split into "## [version]" entries
const changelogEntries = changelog.slice(changelog.indexOf('\n## ') + 1).split(/\n(?=## )/);
const hasMoreEntries = changelogEntries.length > VISIBLE_ENTRIES;
const changelogExpanded = ref(false);
const changelogHtml = computed(() => markdown.render(
  (changelogExpanded.value ? changelogEntries : changelogEntries.slice(0, VISIBLE_ENTRIES)).join('\n'),
));

const openFaq = reactive(new Set<number>());
const toggleFaq = (index: number) => {
  if (openFaq.has(index)) {
    openFaq.delete(index);
  } else {
    openFaq.add(index);
  }
};
</script>

<style>
.info-area {
  display: grid;
  gap: 24px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px 64px;
}

.ad-row {
  display: grid;
  justify-items: center;
  gap: 16px;
}

.info-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.info-nav__link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  transition: color var(--duration) ease, border-color var(--duration) ease, transform var(--duration-fast) ease;
}

.info-nav__link:hover {
  border-color: var(--accent-soft-border);
  color: var(--accent-text);
  text-decoration: none;
  transform: translateY(-1px);
}

.info-nav__link .svg-icon {
  width: 17px;
  height: 17px;
}

.info-section {
  scroll-margin-top: calc(var(--header-height) + 16px);
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
}

.info-section__header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.info-section__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent-text);
}

.info-section__icon .svg-icon {
  width: 22px;
  height: 22px;
}

.info-section__title {
  margin: 0;
  color: var(--text);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.info-section__subtitle {
  margin: 2px 0 0;
  color: var(--text-3);
  font-size: 15px;
}

.print-guide {
  max-width: 78ch;
}

.print-guide .notice {
  margin: 4px 0 16px;
}

/* ---------- FAQ ---------- */
.faq-list {
  display: grid;
  gap: 10px;
}

.faq-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition: border-color var(--duration) ease, box-shadow var(--duration) ease;
}

.faq-item:hover {
  border-color: var(--border-strong);
}

.faq-item.is-open {
  border-color: var(--accent-soft-border);
  box-shadow: var(--shadow-sm);
}

.faq-item__heading {
  margin: 0;
}

.faq-item__question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 16px 18px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text);
  font-size: 15.5px;
  font-weight: 600;
  text-align: left;
}

.faq-item__question:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.faq-item__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface-inset);
  color: var(--text-2);
  transition: transform 300ms var(--ease-out), background-color var(--duration) ease, color var(--duration) ease;
}

.faq-item__icon .svg-icon {
  width: 16px;
  height: 16px;
}

.faq-item.is-open .faq-item__icon {
  background: var(--accent-soft);
  color: var(--accent-text);
  transform: rotate(45deg);
}

.faq-item__answer {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 320ms var(--ease-out);
}

.faq-item.is-open .faq-item__answer {
  grid-template-rows: 1fr;
}

.faq-item__answer-inner {
  min-height: 0;
  overflow: hidden;
}

.faq-item__answer-inner .prose {
  margin: 0;
  padding: 0 18px 18px;
}

.faq-footer {
  margin: 20px 0 0;
  color: var(--text-3);
  font-size: 14px;
  text-align: center;
}

/* ---------- changelog ---------- */
.changelog-body {
  position: relative;
}

.changelog-body.is-collapsed::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, var(--surface));
  pointer-events: none;
}

.changelog-toggle {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .info-area {
    padding: 28px 12px 48px;
  }

  .info-section {
    padding: 20px;
  }
}
</style>
