<template>
  <UiModal :open="open" :title="t('importExportSettings')" icon="settings" size="lg" @close="emit('close')">
    <div class="settings-grid">
      <section class="card">
        <header class="card__header">
          <span class="settings-card__icon"><UiIcon name="file-down" /></span>
          <div>
            <h3 class="card__title">{{ t('exportSettings') }}</h3>
            <p class="settings-card__subtitle">{{ t('exportSettingsDescription') }}</p>
          </div>
        </header>
        <div class="card__body">
          <textarea
            class="textarea textarea--mono settings-json"
            rows="10"
            readonly
            :value="exportJson"
            :aria-label="t('exportSettings')"
            @focus="($event.target as HTMLTextAreaElement).select()"
          ></textarea>
          <div class="button-row">
            <button type="button" class="btn" :class="{ 'is-copied': copied }" @click="copyToClipboard">
              <Transition name="icon-swap" mode="out-in">
                <UiIcon v-if="copied" key="ok" name="check" />
                <UiIcon v-else key="copy" name="copy" />
              </Transition>
              <span>{{ copied ? t('copiedToClipboard') : t('copyToClipboard') }}</span>
            </button>
            <button type="button" class="btn btn--primary" @click="downloadAsFile">
              <UiIcon name="download" />
              <span>{{ t('downloadAsFile') }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="card">
        <header class="card__header">
          <span class="settings-card__icon"><UiIcon name="file-up" /></span>
          <div>
            <h3 class="card__title">{{ t('importSettings') }}</h3>
            <p class="settings-card__subtitle">{{ t('importSettingsDescription') }}</p>
          </div>
        </header>
        <div class="card__body">
          <textarea
            v-model="importJson"
            class="textarea textarea--mono settings-json"
            :class="{ 'is-invalid': importJson.trim() && !parsedImport.valid }"
            rows="10"
            :placeholder="t('pasteJsonHere')"
            :aria-label="t('importSettings')"
          ></textarea>
          <div class="button-row">
            <button type="button" class="btn btn--primary" :disabled="!parsedImport.valid" @click="applySettings">
              <UiIcon name="check" />
              <span>{{ t('applySettings') }}</span>
            </button>
            <label class="btn file-button">
              <input type="file" accept=".json,application/json" @change="loadFromFile" />
              <UiIcon name="upload" />
              <span>{{ t('loadFromFile') }}</span>
            </label>
          </div>
          <Transition name="rise">
            <p v-if="importJson.trim() && !parsedImport.valid" class="field-hint settings-hint--error">
              {{ t('invalidJson') }}
            </p>
          </Transition>
        </div>
      </section>
    </div>
    <template #footer>
      <button type="button" class="btn" @click="emit('close')">{{ t('close') }}</button>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import siteConfig from '@/site.config';
import { toast } from '../composables/useToasts';
import { useWorkbench } from '../composables/useWorkbench';
import { saveText } from '../export/download';
import UiIcon from './ui/UiIcon.vue';
import UiModal from './ui/UiModal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const workbench = useWorkbench();
const exportJson = ref('');
const importJson = ref('');
const copied = ref(false);

watch(() => props.open, (open) => {
  if (open) {
    exportJson.value = JSON.stringify(workbench.exportOptions(), null, 2);
  }
}, { immediate: true });

const parsedImport = computed(() => {
  try {
    return { valid: importJson.value.trim() !== '', data: JSON.parse(importJson.value) as unknown };
  } catch {
    return { valid: false, data: null };
  }
});

const copyToClipboard = async () => {
  await navigator.clipboard.writeText(exportJson.value);
  copied.value = true;
  toast({ type: 'success', icon: 'clipboard', message: t('copiedToClipboard') });
  window.setTimeout(() => {
    copied.value = false;
  }, 2000);
};

const downloadAsFile = () => {
  saveText(exportJson.value, `${siteConfig.filePrefix}-settings-${Date.now()}.json`, 'application/json');
};

const loadFromFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    importJson.value = await file.text();
  }
  // allow loading the same file again
  input.value = '';
};

const applySettings = () => {
  if (!parsedImport.value.valid) {
    return;
  }
  workbench.importOptions(parsedImport.value.data);
  exportJson.value = JSON.stringify(workbench.exportOptions(), null, 2);
  toast({ type: 'success', message: t('settingsApplied') });
};
</script>

<style>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.settings-card__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--surface-inset);
  color: var(--text-2);
}

.settings-card__icon .svg-icon {
  width: 18px;
  height: 18px;
}

.settings-card__subtitle {
  margin: 2px 0 0;
  color: var(--text-3);
  font-size: 12.5px;
  line-height: 1.4;
}

.settings-json.textarea {
  min-height: 210px;
  resize: vertical;
}

.settings-json.is-invalid {
  border-color: var(--danger);
}

.settings-hint--error {
  color: var(--danger-text);
}

.btn.is-copied {
  border-color: var(--accent-soft-border);
  color: var(--accent-text);
}

.file-button {
  position: relative;
  overflow: hidden;
}

.file-button input[type="file"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

@media (max-width: 760px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
