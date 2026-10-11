<template>
  <div class="fonts" role="radiogroup" :aria-label="label">
    <button
      v-for="(font, id) in FONT_FAMILIES"
      :key="id"
      type="button"
      class="font"
      :class="{ 'is-active': model === id }"
      role="radio"
      :aria-checked="model === id ? 'true' : 'false'"
      @click="model = id"
    >
      <span class="font__sample" :style="{ fontFamily: `'preview-${id}', var(--font-sans)` }">Aa</span>
      <span class="font__name">{{ font.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
/** Font choice with each option rendered in its own typeface (loaded from the bundled TTF files). */
import { onMounted } from 'vue';
import {
  FONT_FAMILIES, fontFileUrl, type FontFamilyId,
} from '@/core/geometry/fonts';

defineProps<{ label: string }>();
const model = defineModel<FontFamilyId>({ required: true });

const loaded = new Set<string>();

onMounted(() => {
  (Object.keys(FONT_FAMILIES) as FontFamilyId[]).forEach((id) => {
    const name = `preview-${id}`;
    if (loaded.has(name) || [...document.fonts].some((face) => face.family === name)) {
      return;
    }
    loaded.add(name);
    const face = new FontFace(name, `url(${fontFileUrl(id, 'bold')})`);
    face.load().then((font) => document.fonts.add(font)).catch(() => {});
  });
});
</script>

<style scoped>
.fonts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.font {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 0;
  padding: 6px 4px 7px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-2);
  transition: border-color var(--duration) ease, background-color var(--duration) ease, color var(--duration) ease;
}

.font:hover {
  border-color: var(--input-border-hover);
  color: var(--text);
}

.font.is-active {
  border-color: var(--accent-soft-border);
  background: var(--accent-soft);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--accent-soft-border);
}

.font__sample {
  font-size: 21px;
  line-height: 1.1;
}

.font__name {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
