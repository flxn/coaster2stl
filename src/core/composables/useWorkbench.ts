import {
  computed, inject, provide, reactive, ref, shallowRef, watch, type InjectionKey,
} from 'vue';
import { useI18n } from 'vue-i18n';
import siteConfig from '@/site.config';
import type { ToolDefinition } from '../tool';
import type { ModelPart, ModelWarning } from '../types';
import { cloneOptions, hasValidNumbers, mergeKnownOptions } from '../utils/options';
import { requestModel } from '../worker/client';
import { toast } from './useToasts';

export interface PreviewHandle {
  renderPNG: (options?: { maxSide?: number; fromBelow?: boolean; type?: string; quality?: number }) => Promise<Blob>;
  setProps: (objects: import('three').Object3D[]) => void;
}

const LIVE_UPDATE_DELAY = 380;
const LIVE_UPDATE_KEY = 'liveUpdate';
const SETTINGS_KEY = `${siteConfig.filePrefix}:settings`;
const SAVE_DELAY = 400;

const readSavedSettings = (): unknown => {
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const readLiveUpdate = () => {
  try {
    return window.localStorage.getItem(LIVE_UPDATE_KEY) !== '0';
  } catch {
    return true;
  }
};

/**
 * State of the workbench: the tool options, the generated model and the live-update logic.
 * - results of superseded requests are ignored
 * - the preview is "stale" when the options changed since the shown model was generated
 * - with live update on, a stale preview is regenerated shortly after the last change
 */
export const createWorkbench = <Options extends object>(tool: ToolDefinition<Options>) => {
  const { t } = useI18n();

  const options = reactive(cloneOptions(tool.defaultOptions)) as Options;
  /** applies outside settings: unknown keys and mismatching types are ignored, then the tool repairs the rest */
  const applyOptions = (data: unknown) => {
    mergeKnownOptions(options as Record<string, unknown>, data);
    tool.normalizeOptions?.(options);
  };
  // the last used settings come back on the next visit
  const saved = readSavedSettings();
  if (saved) {
    applyOptions(saved);
  }
  const signature = computed(() => JSON.stringify(options));
  const canAutoGenerate = computed(() => hasValidNumbers(options, tool.defaultOptions) && tool.isReadyForUpdate(options));

  const liveUpdate = ref(readLiveUpdate());
  const isGenerating = ref(false);
  const parts = shallowRef<ModelPart[]>([]);
  const hasModel = computed(() => parts.value.length > 0);
  const generatedSignature = ref<string | null>(null);
  const warnings = ref<ModelWarning[]>([]);
  const generateError = ref<string | null>(null);
  const completedGenerations = ref(0);
  const isStale = computed(() => hasModel.value && generatedSignature.value !== signature.value);

  const modelListeners: ((parts: ModelPart[], info: { first: boolean }) => void)[] = [];
  let latestRequest = 0;
  let autoTimer = 0;
  let autoPending = false;

  const generate = async () => {
    window.clearTimeout(autoTimer);
    autoPending = false;
    latestRequest += 1;
    const requestId = latestRequest;
    const requested = signature.value;
    const first = !hasModel.value;
    isGenerating.value = true;
    generateError.value = null;
    try {
      // a plain copy: reactive proxies cannot be sent to the worker (empty number fields arrive as null)
      const result = await requestModel(JSON.parse(requested));
      if (requestId !== latestRequest) {
        return;
      }
      parts.value = result.parts;
      warnings.value = result.warnings;
      generatedSignature.value = requested;
      completedGenerations.value += 1;
      isGenerating.value = false;
      modelListeners.forEach((listener) => listener(result.parts, { first }));
      if (autoPending || isStale.value) {
        autoPending = false;
        scheduleAutoUpdate();
      }
    } catch (error) {
      if (requestId !== latestRequest) {
        return;
      }
      isGenerating.value = false;
      generateError.value = error instanceof Error ? error.message : String(error);
      toast({ type: 'error', message: `${t('generateFailed')}: ${generateError.value}` });
    }
  };

  function scheduleAutoUpdate() {
    window.clearTimeout(autoTimer);
    if (!liveUpdate.value || !hasModel.value || !isStale.value || !canAutoGenerate.value) {
      return;
    }
    autoTimer = window.setTimeout(() => {
      if (!liveUpdate.value || !isStale.value || !canAutoGenerate.value) {
        return;
      }
      if (isGenerating.value) {
        autoPending = true;
        return;
      }
      generate();
    }, LIVE_UPDATE_DELAY);
  }

  let saveTimer = 0;
  watch(signature, (value) => {
    // any edit makes a previous generation error obsolete
    generateError.value = null;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SETTINGS_KEY, value);
      } catch {
        // storage full or unavailable: settings just are not remembered
      }
    }, SAVE_DELAY);
  });
  watch([signature, canAutoGenerate, liveUpdate], scheduleAutoUpdate);

  const setLiveUpdate = (value: boolean) => {
    liveUpdate.value = value;
    try {
      window.localStorage.setItem(LIVE_UPDATE_KEY, value ? '1' : '0');
    } catch {
      // ignore unavailable storage
    }
  };

  const exportListeners: ((kind: 'stl' | 'png') => void)[] = [];
  /** set by App.vue once the 3D preview exists */
  const preview = shallowRef<PreviewHandle | null>(null);

  const resetOptions = (): Options => {
    const previous: Options = JSON.parse(signature.value);
    const defaults = cloneOptions(tool.defaultOptions) as Record<string, unknown>;
    Object.keys(defaults).forEach((key) => {
      (options as Record<string, unknown>)[key] = defaults[key];
    });
    return previous;
  };

  const workbench = {
    options,
    liveUpdate,
    isGenerating,
    isStale,
    hasModel,
    parts,
    warnings,
    generateError,
    completedGenerations,
    canAutoGenerate,
    generate,
    setLiveUpdate,
    /** applies a settings file; unknown keys and mismatching types are ignored */
    importOptions: applyOptions,
    exportOptions: (): Options => JSON.parse(signature.value),
    /** restores the default settings and returns the previous ones (e.g. for undo with importOptions) */
    resetOptions,
    /** replaces all settings (defaults + `data`, e.g. a shared design); returns the previous ones */
    replaceOptions: (data: unknown): Options => {
      const previous = resetOptions();
      applyOptions(data);
      return previous;
    },
    /** the 3D preview: renders images and shows preview-only objects */
    preview,
    /** called after a file was exported */
    onExport: (listener: (kind: 'stl' | 'png') => void) => {
      exportListeners.push(listener);
    },
    notifyExport: (kind: 'stl' | 'png') => exportListeners.forEach((listener) => listener(kind)),
    /** called after every generation that is shown (first = there was no model before) */
    onModel: (listener: (parts: ModelPart[], info: { first: boolean }) => void) => {
      modelListeners.push(listener);
    },
  };
  return workbench;
};

export type Workbench = ReturnType<typeof createWorkbench<object>>;

const WORKBENCH: InjectionKey<Workbench> = Symbol('workbench');

export const provideWorkbench = (workbench: Workbench) => provide(WORKBENCH, workbench);

export const useWorkbench = (): Workbench => {
  const workbench = inject(WORKBENCH);
  if (!workbench) {
    throw new Error('useWorkbench() needs a workbench provided by App.vue');
  }
  return workbench;
};

/** The reactive tool options, to bind settings with v-model in the tool panel. */
export const useToolOptions = <Options extends object>(): Options => useWorkbench().options as Options;
