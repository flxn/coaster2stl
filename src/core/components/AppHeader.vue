<template>
  <header class="app-header">
    <div ref="inner" class="app-header__inner">
      <a class="brand" href="/" :aria-label="siteConfig.name">
        <img :src="siteConfig.logo" alt="" class="brand__logo" width="34" height="34" />
        <span class="brand__name">{{ siteConfig.name }}</span>
      </a>

      <div v-if="showHeaderAd" class="header-ad">
        <AdSlot name="header" />
      </div>

      <div class="app-header__spacer"></div>

      <div class="app-header__actions">
        <slot name="actions" />
        <button
          type="button"
          class="btn header-btn"
          :data-tip="t('importExportSettings')"
          data-tip-pos="bottom"
          @click="emit('open-settings')"
        >
          <UiIcon name="settings" />
          <span class="header-btn__label">{{ t('importExportSettings') }}</span>
        </button>
        <button
          type="button"
          class="btn btn--ghost header-btn"
          :data-tip="t('resetSettingsTip')"
          data-tip-pos="bottom"
          @click="emit('reset-settings')"
        >
          <UiIcon name="rotate-ccw" />
          <span class="header-btn__label">{{ t('resetSettings') }}</span>
        </button>

        <UiPopover placement="bottom-end" :width="300" panel-class="help-menu">
          <template #trigger="{ toggle, open }">
            <button
              type="button"
              class="btn btn--ghost header-btn"
              :class="{ 'is-open': open }"
              aria-haspopup="menu"
              :aria-expanded="open ? 'true' : 'false'"
              @click="toggle"
            >
              <UiIcon name="help" />
              <span class="header-btn__label">{{ t('help') }}</span>
            </button>
          </template>
          <div class="menu-heading">{{ t('help') }}</div>
          <button type="button" class="menu-item" @click="scrollTo('printguide')">
            <UiIcon name="book-open" />
            <span class="menu-item__label">{{ t('printGuide.title') }}</span>
          </button>
          <button type="button" class="menu-item" @click="scrollTo('faq')">
            <UiIcon name="help" />
            <span class="menu-item__label">{{ t('faqTitle') }}</span>
          </button>
          <button type="button" class="menu-item" @click="scrollTo('changelog')">
            <UiIcon name="scroll-text" />
            <span class="menu-item__label">{{ t('changelog') }}</span>
            <span class="menu-item__meta">v{{ appVersion }}</span>
          </button>

          <div class="menu-divider"></div>
          <div class="menu-heading">{{ t('shortcuts') }}</div>
          <div class="shortcut-row">
            <span>{{ t('generateButton') }}</span>
            <span class="shortcut-keys"><span class="kbd">{{ modifierKey }}</span><span class="kbd">↵</span></span>
          </div>
          <div class="shortcut-row">
            <span>{{ t('exportStl') }}</span>
            <span class="shortcut-keys"><span class="kbd">{{ modifierKey }}</span><span class="kbd">S</span></span>
          </div>
          <div class="shortcut-row">
            <span>{{ t('scrubHint') }}</span>
            <span class="shortcut-keys"><span class="kbd">⇧</span><span class="kbd">↑↓</span></span>
          </div>

          <template v-if="siteConfig.links.repository || siteConfig.links.support || siteConfig.links.directory">
            <div class="menu-divider"></div>
            <a v-if="siteConfig.links.directory" class="menu-item" :href="siteConfig.links.directory" target="_blank" rel="noopener">
              <UiIcon name="box" />
              <span class="menu-item__label">{{ t('moreTools') }}</span>
              <UiIcon name="arrow-up-right" />
            </a>
            <a v-if="siteConfig.links.repository" class="menu-item" :href="siteConfig.links.repository" target="_blank" rel="noopener">
              <UiIcon name="github" />
              <span class="menu-item__label">{{ t('viewSource') }}</span>
              <UiIcon name="arrow-up-right" />
            </a>
            <a
              v-if="siteConfig.links.support"
              class="menu-item support-item"
              :class="{ 'is-thanked': thanked }"
              :href="siteConfig.links.support"
              target="_blank"
              rel="noopener"
              @click="thanked = true"
            >
              <UiIcon name="heart" />
              <span class="menu-item__label">{{ thanked ? t('thankYou') : t('support') }}</span>
              <UiIcon name="arrow-up-right" />
            </a>
          </template>
        </UiPopover>

        <LanguageSelector />

        <button
          type="button"
          class="btn btn--ghost btn--icon theme-toggle"
          :aria-label="themeLabel"
          :data-tip="themeLabel"
          data-tip-pos="bottom"
          data-tip-align="end"
          @click="toggleTheme"
        >
          <Transition name="icon-swap" mode="out-in">
            <UiIcon :key="theme.theme" :name="theme.theme === 'dark' ? 'sun' : 'moon'" />
          </Transition>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import siteConfig from '@/site.config';
import { useTheme } from '../composables/useTheme';
import { modifierKey } from '../utils/platform';
import AdSlot from './AdSlot.vue';
import LanguageSelector from './LanguageSelector.vue';
import UiIcon from './ui/UiIcon.vue';
import UiPopover from './ui/UiPopover.vue';

defineProps<{ showHeaderAd?: boolean }>();
const emit = defineEmits<{ 'open-settings': []; 'reset-settings': [] }>();

const { t, locale } = useI18n();
const { state: theme, toggleTheme } = useTheme();
const appVersion = __APP_VERSION__;
const thanked = ref(false);
const inner = useTemplateRef<HTMLDivElement>('inner');
let resizeObserver: ResizeObserver | null = null;

const themeLabel = computed(() => (theme.theme === 'dark' ? t('themeLight') : t('themeDark')));

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/** Hides the button labels only when they would not fit (their length differs a lot per language). */
const fitHeader = () => {
  const el = inner.value;
  if (!el) {
    return;
  }
  el.classList.remove('is-compact');
  el.classList.toggle('is-compact', el.scrollWidth > el.clientWidth + 1);
};

watch(locale, () => nextTick(fitHeader));

onMounted(() => {
  fitHeader();
  resizeObserver = new ResizeObserver(fitHeader);
  if (inner.value) {
    resizeObserver.observe(inner.value);
  }
  document.fonts?.ready.then(fitHeader);
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style>
.app-header {
  position: sticky;
  z-index: 50;
  top: 0;
  height: var(--header-height);
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: saturate(1.4) blur(14px);
  -webkit-backdrop-filter: saturate(1.4) blur(14px);
}

.app-header__inner {
  display: flex;
  align-items: center;
  gap: 18px;
  height: 100%;
  padding: 0 18px;
}

.brand {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  margin-right: 6px;
  padding: 6px 4px;
  border-radius: var(--radius-sm);
}

.brand__logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.brand__name {
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.brand:hover {
  text-decoration: none;
}

.header-ad {
  display: flex;
  flex: none;
  align-items: center;
  width: 468px;
  height: 60px;
}

.app-header__spacer {
  flex: 1 1 auto;
}

.app-header__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.header-btn {
  height: 42px;
}

.header-btn.is-open {
  background: var(--surface-hover);
  color: var(--text);
}

.theme-toggle {
  width: 42px;
  height: 42px;
}

.help-menu .menu-item > .svg-icon:last-child:not(:first-child) {
  width: 14px;
  height: 14px;
}

.support-item.is-thanked,
.support-item.is-thanked > .svg-icon:first-child {
  color: var(--danger);
}

.support-item.is-thanked > .svg-icon:first-child {
  fill: currentColor;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  padding: 0 10px;
  color: var(--text-2);
  font-size: 13px;
}

.shortcut-keys {
  display: inline-flex;
  gap: 3px;
}

.app-header__inner.is-compact .header-btn__label {
  display: none;
}

.app-header__inner.is-compact .header-btn {
  width: 42px;
  padding: 0;
}

@media (max-width: 760px) {
  .app-header__inner {
    gap: 10px;
    padding: 0 12px;
  }

  .header-btn__label {
    display: none;
  }

  .brand__logo {
    width: 28px;
    height: 28px;
  }

  .brand__name {
    font-size: 15px;
  }

  .app-header__actions {
    gap: 2px;
  }

  .app-header__actions .header-btn,
  .app-header__actions .theme-toggle {
    width: 38px;
    border-color: transparent;
    background: transparent;
  }
}

@media (max-width: 520px) {
  .brand__name {
    display: none;
  }

  .app-header__inner {
    gap: 8px;
    padding: 0 8px;
  }

  .app-header__actions .header-btn,
  .app-header__actions .theme-toggle {
    width: 34px;
  }

  .language-button {
    padding: 0 6px;
  }

  .language-button__chevron {
    display: none;
  }
}
</style>
