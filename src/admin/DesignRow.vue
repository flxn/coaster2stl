<template>
  <article class="design-row" :class="{ 'is-hidden': design.hidden, 'is-busy': busy }">
    <div class="design-row__thumb">
      <img v-if="thumbnail" :src="thumbnail" alt="" />
    </div>

    <div class="design-row__info">
      <h3 class="design-row__title">
        {{ design.title }}
        <span v-if="design.hidden" class="badge badge--muted">Hidden</span>
        <span v-else-if="design.reports" class="badge badge--warning">Reported</span>
      </h3>
      <p class="design-row__meta">
        {{ design.author || 'Anonymous' }} · {{ formatDate(design.createdAt) }} · <code>{{ design.id }}</code>
        <template v-if="design.remixOf"> · remix of <code>{{ design.remixOf }}</code></template>
      </p>
      <p v-if="design.tags.length" class="design-row__tags">
        <span v-for="tag in design.tags" :key="tag">#{{ tag }}</span>
      </p>
      <div class="design-row__counts">
        <span title="Likes"><UiIcon name="heart" /> {{ design.likes }}</span>
        <span title="Prints"><UiIcon name="printer" /> {{ design.downloads }}</span>
        <button
          type="button"
          class="design-row__reports"
          :class="{ 'has-reports': design.reports > 0 }"
          :disabled="!design.reports"
          :aria-expanded="reportsOpen ? 'true' : 'false'"
          @click="toggleReports"
        >
          <UiIcon name="flag" /> {{ design.reports }} {{ design.reports === 1 ? 'report' : 'reports' }}
          <UiIcon v-if="design.reports" :name="reportsOpen ? 'chevron-up' : 'chevron-down'" />
        </button>
      </div>
      <ul v-if="reportsOpen" class="design-row__report-list">
        <li v-if="!reports">Loading…</li>
        <li v-for="(report, index) in reports ?? []" :key="index">
          <span class="design-row__report-date">{{ formatDate(report.created_at) }}</span>
          {{ report.reason || 'No reason given' }}
        </li>
      </ul>
    </div>

    <div class="design-row__actions">
      <a class="btn btn--sm btn--ghost" :href="`/d/${design.id}`" target="_blank" rel="noopener" title="Open the public page (hidden designs show as not found)">
        <UiIcon name="external-link" /><span>Open</span>
      </a>
      <button v-if="design.reports && !design.hidden" type="button" class="btn btn--sm" :disabled="busy" @click="emit('update', { clearReports: true })">
        <UiIcon name="check" /><span>Dismiss reports</span>
      </button>
      <button type="button" class="btn btn--sm" :disabled="busy" @click="emit('update', design.hidden ? { hidden: false, clearReports: true } : { hidden: true })">
        <UiIcon :name="design.hidden ? 'eye' : 'x'" /><span>{{ design.hidden ? 'Restore' : 'Hide' }}</span>
      </button>
      <button type="button" class="btn btn--sm btn--danger" :disabled="busy" @click="emit('delete')">
        <UiIcon name="trash" /><span>Delete</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import { listReports, thumbnailUrl, type AdminDesign } from './api';

const props = defineProps<{ design: AdminDesign; busy: boolean }>();
const emit = defineEmits<{ update: [change: { hidden?: boolean; clearReports?: boolean }]; delete: [] }>();

const thumbnail = ref('');
const reportsOpen = ref(false);
const reports = ref<{ reason: string; created_at: string }[] | null>(null);

const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const toggleReports = async () => {
  reportsOpen.value = !reportsOpen.value;
  if (reportsOpen.value && !reports.value) {
    reports.value = (await listReports(props.design.id).catch(() => ({ items: [] }))).items;
  }
};

// a new report count means the cached reasons are outdated
watch(() => props.design.reports, () => {
  reports.value = null;
  reportsOpen.value = false;
});

onMounted(async () => {
  thumbnail.value = await thumbnailUrl(props.design.id).catch(() => '');
});
</script>

<style scoped>
.design-row {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  transition: opacity var(--duration) ease;
}

.design-row.is-busy {
  opacity: 0.6;
}

.design-row.is-hidden .design-row__thumb img {
  filter: grayscale(1);
  opacity: 0.55;
}

.design-row__thumb {
  width: 84px;
  height: 84px;
  padding: 6px;
  border-radius: var(--radius-md);
  background: var(--surface-inset);
}

.design-row__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.design-row__info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.design-row__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 650;
}

.badge--warning {
  background: var(--warning-soft);
  color: var(--warning-text);
}

.design-row__meta,
.design-row__tags {
  margin: 0;
  overflow: hidden;
  color: var(--text-3);
  font-size: 12.5px;
  text-overflow: ellipsis;
}

.design-row__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.design-row__counts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
  color: var(--text-2);
  font-size: 13px;
}

.design-row__counts span,
.design-row__reports {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.design-row__counts .svg-icon {
  width: 15px;
  height: 15px;
}

.design-row__reports {
  padding: 2px 6px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: inherit;
  font: inherit;
}

.design-row__reports.has-reports {
  color: var(--warning-text);
  font-weight: 600;
}

.design-row__reports.has-reports:hover {
  background: var(--warning-soft);
}

.design-row__reports:disabled {
  cursor: default;
}

.design-row__report-list {
  display: grid;
  gap: 4px;
  margin: 6px 0 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-inset);
  color: var(--text-2);
  font-size: 13px;
  list-style: none;
}

.design-row__report-date {
  margin-right: 8px;
  color: var(--text-3);
  font-size: 12px;
}

.design-row__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 300px;
}

@media (max-width: 760px) {
  .design-row {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .design-row__thumb {
    width: 64px;
    height: 64px;
  }

  .design-row__actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    max-width: none;
  }
}
</style>
