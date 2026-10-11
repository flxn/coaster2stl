<template>
  <div class="swatches" role="radiogroup" :aria-label="label">
    <button
      v-for="color in FILAMENT_COLORS"
      :key="color.id"
      type="button"
      class="swatch"
      :class="{ 'is-active': model.toLowerCase() === color.hex }"
      :style="{ background: color.hex }"
      role="radio"
      :aria-checked="model.toLowerCase() === color.hex ? 'true' : 'false'"
      :aria-label="t(`tool.filament.${color.id}`)"
      :data-tip="t(`tool.filament.${color.id}`)"
      @click="model = color.hex"
    ></button>
    <label class="swatch swatch--custom" :class="{ 'is-active': isCustom }" :data-tip="t('tool.customColor')" :style="isCustom ? { background: model } : undefined">
      <input v-model="model" type="color" :aria-label="t('tool.customColor')" />
      <UiIcon v-if="!isCustom" name="plus" />
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import { FILAMENT_COLORS } from '../catalog';

defineProps<{ label: string }>();
const model = defineModel<string>({ required: true });
const { t } = useI18n();

const isCustom = computed(() => !FILAMENT_COLORS.some((color) => color.hex === model.value.toLowerCase()));
</script>

<style scoped>
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.swatch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.35), inset 0 -2px 3px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: transform var(--duration-fast) ease, box-shadow var(--duration) ease;
}

.swatch:hover {
  transform: scale(1.12);
}

.swatch.is-active {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
}

.swatch--custom {
  border-style: dashed;
  border-color: var(--border-hover);
  background: var(--surface);
  color: var(--text-3);
}

.swatch--custom .svg-icon {
  width: 14px;
  height: 14px;
}

.swatch--custom input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
