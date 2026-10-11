<template>
  <div class="app-shell">
    <AppHeader :show-header-ad="headerAdInHeader" @open-settings="settingsOpen = true" @reset-settings="resetSettings">
      <template v-if="tool.headerActions" #actions>
        <component :is="tool.headerActions" />
      </template>
    </AppHeader>

    <main id="main" class="workbench">
      <h1 class="sr-only">{{ t('title') }}</h1>
      <p class="sr-only">{{ t('subtitle') }}</p>

      <aside class="sidebar" :aria-label="t('settingsPanel')">
        <component :is="tool.panel" />
      </aside>

      <section class="stage" :aria-label="t('preview')">
        <PreviewViewport
          ref="viewport"
          :theme="theme.theme"
          :has-model="workbench.hasModel.value"
          :is-generating="workbench.isGenerating.value"
          :is-stale="workbench.isStale.value"
          :live-update="workbench.liveUpdate.value"
          :warnings="warnings"
          :empty-hint="t('emptyHint')"
          @update:live-update="setLiveUpdate"
          @generate="workbench.generate"
        >
          <template v-if="tool.viewportActions" #toolbar>
            <component :is="tool.viewportActions" />
          </template>
        </PreviewViewport>
        <ActionBar
          ref="actionBar"
          v-model:format="stlFormat"
          v-model:separate-parts="separateParts"
          :is-generating="workbench.isGenerating.value"
          :is-stale="workbench.isStale.value"
          :has-model="workbench.hasModel.value"
          :completed-generations="workbench.completedGenerations.value"
          @generate="workbench.generate"
          @export-stl="startExport('stl')"
          @render-png="startExport('png')"
          @need-model="needModel"
        />
      </section>
    </main>

    <InfoArea :faq="tool.faq" :show-ads="adsMounted" :header-ad-in-header="headerAdInHeader">
      <template v-if="tool.infoSection" #before>
        <component :is="tool.infoSection" />
      </template>
    </InfoArea>
    <AppFooter />
    <ToastHost />

    <SettingsModal :open="settingsOpen" @close="settingsOpen = false" />
    <ExportModal :open="exportKind !== null" :kind="exportKind ?? 'stl'" :delay="EXPORT_DELAY" @close="exportKind = null" />
  </div>
</template>

<script setup lang="ts">
import {
  onBeforeUnmount, onMounted, ref, useTemplateRef,
} from 'vue';
import { useI18n } from 'vue-i18n';
import siteConfig from '@/site.config';
import tool from '@/tool';
import { getAdUnit } from './core/ads';
import ActionBar from './core/components/ActionBar.vue';
import AppFooter from './core/components/AppFooter.vue';
import AppHeader from './core/components/AppHeader.vue';
import ExportModal from './core/components/ExportModal.vue';
import InfoArea from './core/components/InfoArea.vue';
import PreviewViewport from './core/components/PreviewViewport.vue';
import SettingsModal from './core/components/SettingsModal.vue';
import ToastHost from './core/components/ToastHost.vue';
import { useModelWarnings } from './core/composables/useModelWarnings';
import { useTheme } from './core/composables/useTheme';
import { toast } from './core/composables/useToasts';
import { createWorkbench, provideWorkbench, type Workbench } from './core/composables/useWorkbench';
import { saveBlob } from './core/export/download';
import { exportStl, type StlFormat } from './core/export/stl';

// seconds the export dialog (with its ad) is shown before the download starts
const EXPORT_DELAY = 5;
const WIDE_HEADER_QUERY = '(min-width: 1780px)';

const { t } = useI18n();
const { state: theme } = useTheme();
const workbench = createWorkbench(tool);
provideWorkbench(workbench as unknown as Workbench);
const { warnings } = useModelWarnings(workbench as unknown as Workbench);

const viewport = useTemplateRef<InstanceType<typeof PreviewViewport>>('viewport');
const actionBar = useTemplateRef<InstanceType<typeof ActionBar>>('actionBar');
const stlFormat = ref<StlFormat>('binary');
const separateParts = ref(false);
const settingsOpen = ref(false);
const exportKind = ref<'stl' | 'png' | null>(null);
// where the 468×60 unit goes is decided once, so resizing never reloads an ad
const headerAdInHeader = ref(false);
const adsMounted = ref(false);
let exportTimer = 0;

workbench.onModel((parts, { first }) => {
  viewport.value?.showModel(parts, { fit: first, animate: first });
});

const setLiveUpdate = (value: boolean) => {
  workbench.setLiveUpdate(value);
  toast({ type: 'info', icon: 'zap', message: value ? t('liveUpdateOn') : t('liveUpdateOff') });
};

const needModel = () => toast({ type: 'info', message: t('generateFirst') });

const resetSettings = () => {
  const previous = workbench.resetOptions();
  toast({
    type: 'info',
    icon: 'rotate-ccw',
    message: t('settingsReset'),
    action: {
      label: t('undo'),
      run: () => {
        workbench.importOptions(previous);
        toast({ type: 'success', message: t('settingsRestored') });
      },
    },
  });
};

const performExport = async (kind: 'stl' | 'png') => {
  try {
    if (kind === 'stl') {
      await exportStl(workbench.parts.value, {
        format: stlFormat.value,
        separateParts: separateParts.value,
        filePrefix: siteConfig.filePrefix,
      });
      toast({ type: 'success', icon: 'download', message: t('downloadStarted') });
      workbench.notifyExport('stl');
    } else if (viewport.value) {
      saveBlob(await viewport.value.renderPNG(), `${siteConfig.filePrefix}-${Date.now()}.png`);
      toast({ type: 'success', icon: 'image', message: t('pngSaved') });
      workbench.notifyExport('png');
    }
  } catch (error) {
    toast({ type: 'error', message: `${t('exportFailed')}: ${error instanceof Error ? error.message : error}` });
  }
};

/** With an export ad configured, the file is created after the countdown (even if the dialog is closed). */
const startExport = (kind: 'stl' | 'png') => {
  if (!workbench.hasModel.value) {
    actionBar.value?.nudge();
    needModel();
    return;
  }
  window.clearTimeout(exportTimer);
  if (!getAdUnit('export')) {
    performExport(kind);
    return;
  }
  exportKind.value = kind;
  exportTimer = window.setTimeout(() => performExport(kind), EXPORT_DELAY * 1000);
};

const onKeydown = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || document.documentElement.classList.contains('has-modal')) {
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    workbench.generate();
  } else if (event.key.toLowerCase() === 's' && !event.shiftKey) {
    event.preventDefault();
    startExport('stl');
  }
};

onMounted(() => {
  workbench.preview.value = {
    renderPNG: (options) => viewport.value?.renderPNG(options) ?? Promise.reject(new Error('Preview not ready')),
    setProps: (objects) => viewport.value?.setProps(objects),
  };
  headerAdInHeader.value = window.matchMedia(WIDE_HEADER_QUERY).matches;
  adsMounted.value = true;
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.clearTimeout(exportTimer);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style>
.app-shell {
  min-height: 100vh;
}

.workbench {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - var(--header-height));
  height: calc(100dvh - var(--header-height));
  min-height: 620px;
  padding: 14px 18px 18px;
}

.sidebar {
  position: relative;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.stage {
  container: stage / inline-size;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1240px) {
  .workbench {
    gap: 12px;
    padding: 12px;
  }
}

@media (max-width: 900px) {
  .workbench {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 0;
    padding: 10px;
  }

  .stage {
    display: contents;
  }

  .viewport {
    order: 1;
    height: 58vh;
    min-height: 340px;
  }

  .sidebar {
    order: 2;
    overflow: visible;
  }

  .panel-tabs {
    top: var(--header-height);
  }

  .action-bar {
    position: sticky;
    z-index: 30;
    bottom: 10px;
    order: 3;
    box-shadow: var(--shadow-lg);
  }

  .tool-button__label {
    display: none;
  }
}
</style>
