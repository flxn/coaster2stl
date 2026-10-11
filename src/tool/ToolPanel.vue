<template>
  <div class="tool-panel">
    <div class="coaster-intro">
      <p v-if="coasterState.loaded" class="coaster-intro__remix">
        <UiIcon name="git-fork" />
        <span>
          {{ isUnchanged() ? t('tool.intro.opened') : t('tool.intro.remixing') }}
          <strong>{{ coasterState.loaded.title }}</strong>
          <template v-if="coasterState.loaded.author">{{ t('tool.intro.by', { author: coasterState.loaded.author }) }}</template>
        </span>
        <button type="button" class="coaster-intro__close" :aria-label="t('tool.intro.forget')" @click="coasterState.loaded = null">
          <UiIcon name="x" />
        </button>
      </p>
      <div class="coaster-intro__buttons">
        <button type="button" class="btn btn--sm surprise-button" :class="{ 'is-rolling': rolling }" @click="surpriseMe" @animationend="rolling = false">
          <UiIcon name="dices" /><span>{{ t('tool.surprise') }}</span>
        </button>
      </div>
    </div>

    <UiTabs v-model="tab" class="panel-tabs" :tabs="tabs" :aria-label="t('settingsPanel')" />

    <div class="tab-panels">
      <!-- design -->
      <div v-show="tab === 'design'" class="tab-panel" role="tabpanel">
        <UiSection :title="t('tool.artwork')" default-open>
          <ArtworkPicker v-model="options.artwork" @brand-color="offerBrandColor" />
          <template v-if="options.artwork.source !== 'none'">
            <UiSlider
              v-model="options.artwork.scale"
              :label="t('tool.artworkSize')"
              :min="10"
              :max="100"
              :step="1"
              unit=" %"
              :reset-to="46"
              :reset-label="t('tool.reset')"
            />
            <UiSlider
              v-model="options.artwork.rotation"
              :label="t('tool.rotation')"
              :min="-180"
              :max="180"
              :step="5"
              unit="°"
              :reset-to="0"
              :reset-label="t('tool.reset')"
            />
            <div class="field-grid">
              <UiNumberField v-model="options.artwork.offsetX" :label="t('tool.offsetX')" stack :step="1" :warning="warningFor('artworkClipped')" />
              <UiNumberField v-model="options.artwork.offsetY" :label="t('tool.offsetY')" stack :step="1" />
            </div>
          </template>
        </UiSection>

        <UiSection :title="t('tool.sketch.section')" default-open>
          <div class="sketch-card">
            <button type="button" class="sketch-card__thumb" :aria-label="t('tool.sketch.open')" @click="coasterState.sketchpadOpen = true">
              <DrawingThumb :drawing="options.drawing" :color="options.colors.design" :base="options.colors.base" />
              <span v-if="!options.drawing.strokes.length" class="sketch-card__empty"><UiIcon name="brush" /></span>
            </button>
            <div class="sketch-card__text">
              <p>{{ options.drawing.strokes.length ? t('tool.sketch.summary', { count: options.drawing.strokes.length, symmetry: t(`tool.sketch.symmetries.${options.drawing.symmetry}`) }, options.drawing.strokes.length) : t('tool.sketch.intro') }}</p>
              <div class="button-row">
                <button type="button" class="btn btn--sm btn--accent-outline" @click="coasterState.sketchpadOpen = true">
                  <UiIcon name="pencil" /><span>{{ options.drawing.strokes.length ? t('tool.sketch.edit') : t('tool.sketch.open') }}</span>
                </button>
                <button v-if="options.drawing.strokes.length" type="button" class="btn btn--sm btn--ghost" @click="clearDrawing">
                  <UiIcon name="trash" /><span>{{ t('tool.sketch.clear') }}</span>
                </button>
              </div>
            </div>
          </div>
        </UiSection>
      </div>

      <!-- text -->
      <div v-show="tab === 'text'" class="tab-panel" role="tabpanel">
        <UiSection :title="t('tool.ringText')" default-open>
          <p class="field-hint">{{ t('tool.ringTextHelp') }}</p>
          <UiField :label="t('tool.textTop')" stack>
            <input v-model="options.text.top" class="input" maxlength="120" :placeholder="t('tool.textTopPlaceholder')" />
          </UiField>
          <UiField :label="t('tool.textBottom')" stack>
            <input v-model="options.text.bottom" class="input" maxlength="120" :placeholder="t('tool.textBottomPlaceholder')" />
          </UiField>
          <UiNumberField
            v-model="options.text.size"
            :label="t('tool.textSize')"
            :min="2"
            :step="0.5"
            :warning="warningFor('ringTextScaled', 'textSmall')"
          />
          <UiSlider
            v-model="options.text.letterSpacing"
            :label="t('tool.letterSpacing')"
            :min="-0.05"
            :max="0.5"
            :step="0.01"
            :reset-to="0.12"
            :reset-label="t('tool.reset')"
          />
        </UiSection>

        <UiSection :title="t('tool.centerText')" default-open>
          <textarea
            v-model="options.text.center"
            v-autosize
            class="textarea"
            rows="2"
            maxlength="120"
            :placeholder="t('tool.centerTextPlaceholder')"
            :aria-label="t('tool.centerText')"
            :style="{ textAlign: options.text.centerAlign }"
          ></textarea>
          <UiField :label="t('alignment')">
            <UiSegmented v-model="options.text.centerAlign" icons-only :options="alignOptions" :aria-label="t('alignment')" />
          </UiField>
          <UiNumberField v-model="options.text.centerSize" :label="t('tool.textSize')" :min="2" :step="0.5" :warning="warningFor('centerTextScaled')" />
        </UiSection>

        <UiSection :title="t('tool.font')" default-open>
          <FontPicker v-model="options.text.font" :label="t('tool.font')" />
          <UiField :label="t('tool.bold')" :help="t('tool.boldHelp')">
            <UiToggle v-model="options.text.bold" :aria-label="t('tool.bold')" />
          </UiField>
        </UiSection>
      </div>

      <!-- style -->
      <div v-show="tab === 'style'" class="tab-panel" role="tabpanel">
        <UiSection :title="t('tool.themes')" default-open>
          <div class="themes">
            <button
              v-for="(theme, id) in THEMES"
              :key="id"
              type="button"
              class="theme-chip"
              :class="{ 'is-active': activeTheme === id }"
              :style="{ background: theme.base, color: theme.design }"
              @click="applyTheme(theme)"
            >
              <span class="theme-chip__dot" :style="{ background: theme.accent }"></span>
              <span class="theme-chip__name">{{ t(`tool.themeNames.${id}`) }}</span>
            </button>
          </div>
        </UiSection>

        <UiSection :title="t('tool.colors')" default-open>
          <p class="field-hint">{{ t('tool.colorsHelp') }}</p>
          <UiField :label="t('tool.colorBase')" stack>
            <ColorSwatches v-model="options.colors.base" :label="t('tool.colorBase')" />
          </UiField>
          <UiField :label="t('tool.colorDesign')" stack>
            <ColorSwatches v-model="options.colors.design" :label="t('tool.colorDesign')" />
          </UiField>
          <UiField :label="t('tool.colorAccent')" stack>
            <ColorSwatches v-model="options.colors.accent" :label="t('tool.colorAccent')" />
          </UiField>
        </UiSection>

        <UiSection :title="t('tool.pattern')" default-open>
          <PatternPicker v-model="options.pattern.type" :label="t('tool.pattern')" />
          <UiCollapse :open="options.pattern.type !== 'none'">
            <UiSlider v-model="options.pattern.spacing" :label="t('tool.patternSpacing')" :min="3" :max="24" :step="0.5" unit=" mm" :reset-to="8" :reset-label="t('tool.reset')" />
            <UiSlider v-model="options.pattern.weight" :label="t('tool.patternWeight')" :min="0.6" :max="6" :step="0.1" unit=" mm" :reset-to="1.6" :reset-label="t('tool.reset')" />
            <UiSlider
              v-model="options.pattern.clearance"
              :label="t('tool.patternClearance')"
              :help="t('tool.patternClearanceHelp')"
              :min="0"
              :max="10"
              :step="0.5"
              unit=" mm"
              :reset-to="2.5"
              :reset-label="t('tool.reset')"
            />
            <UiSlider
              v-if="options.pattern.type !== 'rings' && options.pattern.type !== 'terrazzo'"
              v-model="options.pattern.rotation"
              :label="t('tool.rotation')"
              :min="0"
              :max="90"
              :step="5"
              unit="°"
              :reset-to="0"
              :reset-label="t('tool.reset')"
            />
            <button v-if="options.pattern.type === 'terrazzo'" type="button" class="btn btn--sm" @click="options.pattern.seed = Math.floor(Math.random() * 100000)">
              <UiIcon name="dices" /><span>{{ t('tool.shuffle') }}</span>
            </button>
          </UiCollapse>
        </UiSection>
      </div>

      <!-- coaster -->
      <div v-show="tab === 'coaster'" class="tab-panel" role="tabpanel">
        <UiSection :title="t('tool.shape')" default-open>
          <ShapePicker :model-value="options.coaster.shape" :label="t('tool.shape')" @update:model-value="setShape" />
          <UiNumberField v-model="options.coaster.size" :label="t('tool.size')" :help="t('tool.sizeHelp')" :min="40" :max="250" />
          <UiNumberField v-model="options.coaster.thickness" :label="t('thickness')" :min="1.6" :max="15" :step="0.2" :warning="warningFor('depthLimited')" />
          <UiCollapse :open="CORNERED_SHAPES.includes(options.coaster.shape)">
            <UiNumberField v-model="options.coaster.cornerRadius" :label="t('cornerRadius')" :min="0" :step="0.5" />
          </UiCollapse>
          <UiCollapse :open="!!lobeRange">
            <UiSlider
              v-if="lobeRange"
              v-model="options.coaster.lobes"
              :label="t(`tool.lobes.${options.coaster.shape}`)"
              :min="lobeRange.min"
              :max="lobeRange.max"
              :step="1"
              :reset-to="lobeRange.default"
              :reset-label="t('tool.reset')"
            />
          </UiCollapse>
        </UiSection>

        <UiSection v-model:enabled="options.rim.enabled" :title="t('tool.rim')" toggleable :toggle-title="t('tool.rimHelp')">
          <p class="field-hint">{{ t('tool.rimHelp') }}</p>
          <UiNumberField v-model="options.rim.width" :label="t('tool.rimWidth')" :min="0.8" :step="0.2" />
          <UiNumberField v-model="options.rim.height" :label="t('tool.rimHeight')" :min="0.2" :step="0.2" :warning="warningFor('rimLow', 'rimFaceDown')" />
        </UiSection>

        <UiSection :title="t('tool.print')" default-open>
          <UiSegmented v-model="options.print.relief" block :options="reliefOptions" :aria-label="t('tool.relief')" />
          <p class="field-hint">{{ t(`tool.reliefHelp.${options.print.relief}`) }}</p>
          <UiNumberField v-model="options.print.depth" :label="t('tool.depth')" :min="0.2" :max="5" :step="0.2" />
          <UiField :label="t('tool.faceDown')" :help="t('tool.faceDownHelp')">
            <UiToggle v-model="options.print.faceDown" :disabled="options.print.relief === 'raised'" :aria-label="t('tool.faceDown')" />
          </UiField>
        </UiSection>

        <UiSection :title="t('tool.bottom')" default-open>
          <UiSegmented v-model="options.bottom.style" block :options="bottomOptions" :aria-label="t('tool.bottom')" />
          <p class="field-hint">{{ t(`tool.bottomHelp.${options.bottom.style}`) }}</p>
          <p v-if="options.bottom.style === 'cork' && !(options.print.faceDown && options.print.relief !== 'raised')" class="notice notice--warning">
            <UiIcon name="alert" /><span>{{ t('warnings.corkBridgingHelp') }}</span>
          </p>
          <template v-if="options.bottom.style !== 'flat'">
            <UiNumberField v-model="options.bottom.depth" :label="t('tool.pocketDepth')" :min="0.4" :max="6" :step="0.1" />
            <UiNumberField v-if="options.bottom.style === 'cork'" v-model="options.bottom.margin" :label="t('tool.corkMargin')" :min="1.5" :step="0.5" />
            <UiNumberField v-else v-model="options.bottom.feetDiameter" :label="t('tool.feetDiameter')" :min="3" :max="30" :step="0.5" />
          </template>
        </UiSection>
      </div>
    </div>

    <SketchPad
      v-model="options.drawing"
      :open="coasterState.sketchpadOpen"
      :design-radius="designRadius"
      :colors="options.colors"
      :guide="sketchGuide"
      @close="coasterState.sketchpadOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * The coaster's settings sidebar. Edits the options from useToolOptions() directly;
 * the workbench regenerates the model, saves the settings and detects outdated previews.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import UiCollapse from '@/core/components/ui/UiCollapse.vue';
import UiField from '@/core/components/ui/UiField.vue';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiNumberField from '@/core/components/ui/UiNumberField.vue';
import UiSection from '@/core/components/ui/UiSection.vue';
import UiSegmented from '@/core/components/ui/UiSegmented.vue';
import UiSlider from '@/core/components/ui/UiSlider.vue';
import UiTabs from '@/core/components/ui/UiTabs.vue';
import UiToggle from '@/core/components/ui/UiToggle.vue';
import { useModelWarnings } from '@/core/composables/useModelWarnings';
import { toast } from '@/core/composables/useToasts';
import { useToolOptions, useWorkbench } from '@/core/composables/useWorkbench';
import type { TextAlign } from '@/core/geometry/text';
import { CORNERED_SHAPES, THEMES, type CoasterShape } from './catalog';
import ArtworkPicker from './components/ArtworkPicker.vue';
import ColorSwatches from './components/ColorSwatches.vue';
import DrawingThumb from './components/DrawingThumb.vue';
import FontPicker from './components/FontPicker.vue';
import PatternPicker from './components/PatternPicker.vue';
import ShapePicker from './components/ShapePicker.vue';
import SketchPad from './components/SketchPad.vue';
import type { ToolOptions } from './options';
import { LOBE_RANGES } from './outline';
import { coasterState, useDesignLoader } from './state';
import { surprise } from './surprise';

const { t } = useI18n();
const workbench = useWorkbench();
const options = useToolOptions<ToolOptions>();
const { warningFor } = useModelWarnings();
const { isUnchanged } = useDesignLoader();

const tab = ref('design');
const rolling = ref(false);

const tabs = computed(() => [
  { id: 'design', label: t('tool.tabs.design'), icon: 'image' },
  { id: 'text', label: t('tool.tabs.text'), icon: 'type' },
  { id: 'style', label: t('tool.tabs.style'), icon: 'palette' },
  { id: 'coaster', label: t('tool.tabs.coaster'), icon: 'circle' },
]);

const alignOptions = computed(() => [
  { value: 'left' as TextAlign, icon: 'align-left', tip: t('alignLeft') },
  { value: 'center' as TextAlign, icon: 'align-center', tip: t('alignCenter') },
  { value: 'right' as TextAlign, icon: 'align-right', tip: t('alignRight') },
]);

const reliefOptions = computed(() => (['raised', 'engraved', 'inlay'] as const).map((value) => ({ value, label: t(`tool.reliefs.${value}`) })));
const bottomOptions = computed(() => (['flat', 'cork', 'feet'] as const).map((value) => ({ value, label: t(`tool.bottoms.${value}`) })));

const lobeRange = computed(() => {
  const { shape } = options.coaster;
  return shape === 'flower' || shape === 'scallop' || shape === 'gear' ? LOBE_RANGES[shape] : null;
});

/** a newly picked lobed shape starts with its typical number of lobes */
const setShape = (shape: CoasterShape) => {
  options.coaster.shape = shape;
  if (shape === 'flower' || shape === 'scallop' || shape === 'gear') {
    options.coaster.lobes = LOBE_RANGES[shape].default;
  }
};

/** radius of the design area in mm, as the generator computes it (close enough for the sketchpad) */
const designRadius = computed(() => {
  const size = Number.isFinite(options.coaster.size) ? options.coaster.size : 100;
  const rim = options.rim.enabled ? (Number.isFinite(options.rim.width) ? options.rim.width : 3) + 0.6 : 1.2;
  return Math.max(10, size / 2 - rim);
});

const sketchGuide = computed(() => {
  const { artwork } = options;
  if (artwork.source === 'none') return null;
  return {
    path: artwork.source === 'icon' ? artwork.icon?.path : undefined,
    upload: artwork.source === 'upload' ? artwork.upload : null,
    scale: Number.isFinite(artwork.scale) ? artwork.scale : 46,
    rotation: Number.isFinite(artwork.rotation) ? artwork.rotation : 0,
    offsetX: Number.isFinite(artwork.offsetX) ? artwork.offsetX : 0,
    offsetY: Number.isFinite(artwork.offsetY) ? artwork.offsetY : 0,
  };
});

const activeTheme = computed(() => Object.entries(THEMES).find(([, theme]) => theme.base === options.colors.base
  && theme.design === options.colors.design && theme.accent === options.colors.accent)?.[0]);

const applyTheme = (theme: (typeof THEMES)[keyof typeof THEMES]) => {
  options.colors.base = theme.base;
  options.colors.design = theme.design;
  options.colors.accent = theme.accent;
};

/** a brand logo was picked: offer its brand color for the design */
const offerBrandColor = (hex: string) => {
  if (hex.toLowerCase() === options.colors.design.toLowerCase()) return;
  toast({
    type: 'info',
    icon: 'palette',
    message: t('tool.brandColor'),
    action: {
      label: t('tool.brandColorApply'),
      run: () => {
        options.colors.design = hex.toLowerCase();
      },
    },
  });
};

const surpriseMe = () => {
  const previous = workbench.exportOptions();
  rolling.value = true;
  surprise(options);
  toast({
    type: 'info',
    icon: 'dices',
    message: t('tool.surprised'),
    action: { label: t('undo'), run: () => workbench.importOptions(previous) },
  });
  if (!workbench.hasModel.value) {
    workbench.generate();
  }
};

const clearDrawing = () => {
  const previous = options.drawing.strokes;
  options.drawing.strokes = [];
  toast({
    type: 'info',
    icon: 'trash',
    message: t('tool.sketch.cleared'),
    action: {
      label: t('undo'),
      run: () => {
        options.drawing.strokes = previous;
      },
    },
  });
};
</script>

<style scoped>
.coaster-intro {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.coaster-intro__buttons {
  display: flex;
  gap: 8px;
}

.coaster-intro__buttons .btn {
  flex: 1 1 0;
}

.coaster-intro__remix {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--accent-soft-border);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.4;
}

.coaster-intro__remix > .svg-icon {
  flex-shrink: 0;
  color: var(--accent);
}

.coaster-intro__remix span {
  flex: 1 1 auto;
  min-width: 0;
}

.coaster-intro__close {
  display: inline-flex;
  flex-shrink: 0;
  padding: 2px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-3);
}

.coaster-intro__close:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.surprise-button .svg-icon {
  transition: transform 300ms var(--ease-spring);
}

.surprise-button:hover .svg-icon {
  transform: rotate(-20deg);
}

.surprise-button.is-rolling .svg-icon {
  animation: dice-roll 600ms var(--ease-out);
}

@keyframes dice-roll {
  0% { transform: rotate(0) scale(1); }
  50% { transform: rotate(270deg) scale(1.3); }
  100% { transform: rotate(360deg) scale(1); }
}

.sketch-card {
  display: flex;
  gap: 12px;
  align-items: center;
}

.sketch-card__thumb {
  position: relative;
  flex-shrink: 0;
  width: 92px;
  height: 92px;
  padding: 4px;
  border: 1px dashed var(--border-hover);
  border-radius: var(--radius-md);
  background: var(--surface-inset);
  transition: border-color var(--duration) ease, transform 300ms var(--ease-spring);
}

.sketch-card__thumb:hover {
  border-color: var(--accent);
  transform: rotate(-4deg);
}

.sketch-card__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
}

.sketch-card__empty .svg-icon {
  width: 26px;
  height: 26px;
}

.sketch-card__text {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.sketch-card__text p {
  margin: 0;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.45;
}

.themes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.theme-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 38px;
  padding: 0 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 650;
  transition: transform var(--duration-fast) ease, box-shadow var(--duration) ease;
}

.theme-chip:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.theme-chip.is-active {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}

.theme-chip__dot {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 50%;
}

.theme-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
