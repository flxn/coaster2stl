<template>
  <button
    type="button"
    class="tool-button tool-button--mug"
    :class="{ 'is-on': coasterState.showMug && !faceDown }"
    :disabled="faceDown"
    :aria-pressed="coasterState.showMug ? 'true' : 'false'"
    :data-tip="faceDown ? t('tool.mugFaceDown') : t('tool.mugTip')"
    data-tip-pos="bottom"
    data-tip-align="end"
    @click="coasterState.showMug = !coasterState.showMug"
  >
    <UiIcon name="coffee" />
    <span class="tool-button__label">{{ t('tool.mug') }}</span>
  </button>
</template>

<script setup lang="ts">
/**
 * Toolbar toggle that puts a mug on the coaster in the 3D preview (never exported),
 * so you can see at a glance whether the coaster is big enough.
 */
import { computed, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import { useToolOptions, useWorkbench } from '@/core/composables/useWorkbench';
import { createMug } from '../mug';
import type { ToolOptions } from '../options';
import { coasterState } from '../state';

const { t } = useI18n();
const workbench = useWorkbench();
const options = useToolOptions<ToolOptions>();

/** face-down prints are shown upside down, so there is no top to put a mug on */
const faceDown = computed(() => options.print.relief !== 'raised' && options.print.faceDown);

/** the mug stands on the highest part of the top: the rim or the raised design */
const standHeight = () => {
  const thickness = Number.isFinite(options.coaster.thickness) ? options.coaster.thickness : 4;
  const depth = options.print.relief === 'raised' && Number.isFinite(options.print.depth) ? options.print.depth : 0;
  const rim = options.rim.enabled && Number.isFinite(options.rim.height) ? options.rim.height : 0;
  return thickness + Math.max(depth, rim);
};

// the mug is only replaced when it changes, so live updates do not move the camera
let shown: string | null = null;
const update = () => {
  const show = coasterState.showMug && workbench.hasModel.value && !faceDown.value;
  const key = show ? standHeight().toFixed(2) : 'none';
  if (key === shown || !workbench.preview.value) {
    return;
  }
  shown = key;
  workbench.preview.value.setProps(show ? [createMug({ z: standHeight() })] : []);
};

watch(() => [coasterState.showMug, workbench.hasModel.value, workbench.preview.value, faceDown.value], update);
workbench.onModel(update);
watch(() => coasterState.showMug, (show) => {
  if (show && !workbench.hasModel.value) {
    workbench.generate();
  }
});
onBeforeUnmount(() => workbench.preview.value?.setProps([]));
</script>

<style scoped>
.tool-button--mug.is-on {
  color: var(--accent-text);
}

.tool-button--mug.is-on .svg-icon {
  fill: currentColor;
  fill-opacity: 0.25;
}
</style>
