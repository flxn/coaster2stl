<template>
  <div class="admin">
    <!-- sign in -->
    <main v-if="!token" class="admin-login">
      <form class="admin-login__card" @submit.prevent="submit">
        <img :src="siteConfig.logo" alt="" width="56" height="56" />
        <h1>Gallery moderation</h1>
        <p class="field-hint">{{ siteConfig.name }} · enter the admin token configured on the server (<code>ADMIN_TOKEN</code>).</p>
        <input
          v-model="tokenInput"
          class="input input--lg"
          type="password"
          autocomplete="current-password"
          placeholder="Admin token"
          aria-label="Admin token"
          required
          autofocus
        />
        <p v-if="loginError" class="notice notice--danger"><UiIcon name="alert" /><span>{{ loginError }}</span></p>
        <button type="submit" class="btn btn--lg btn--primary" :disabled="signingIn || !tokenInput">
          <UiIcon :name="signingIn ? 'loader' : 'key'" :class="{ spin: signingIn }" /><span>Sign in</span>
        </button>
        <p v-if="isDev" class="field-hint">Development server: the token is <code>dev</code> unless ADMIN_TOKEN is set.</p>
      </form>
    </main>

    <!-- moderation -->
    <template v-else>
      <header class="admin-header">
        <a class="admin-header__brand" href="/" target="_blank" rel="noopener">
          <img :src="siteConfig.logo" alt="" width="30" height="30" />
          <span>{{ siteConfig.name }}</span>
        </a>
        <span class="admin-header__title">Moderation</span>
        <span class="admin-header__spacer"></span>
        <button type="button" class="btn btn--ghost btn--icon" :aria-label="themeLabel" :data-tip="themeLabel" data-tip-pos="bottom" @click="toggleTheme">
          <UiIcon :name="theme.theme === 'dark' ? 'sun' : 'moon'" />
        </button>
        <button type="button" class="btn" @click="logout">
          <UiIcon name="arrow-left" /><span>Sign out</span>
        </button>
      </header>

      <main class="admin-main">
        <section v-if="stats" class="admin-stats" aria-label="Statistics">
          <div class="admin-stat"><strong>{{ stats.designs }}</strong><span>designs</span></div>
          <div class="admin-stat" :class="{ 'is-alert': stats.reported }"><strong>{{ stats.reported }}</strong><span>reported</span></div>
          <div class="admin-stat"><strong>{{ stats.hidden }}</strong><span>hidden</span></div>
          <div class="admin-stat"><strong>{{ stats.likes }}</strong><span>likes</span></div>
          <div class="admin-stat"><strong>{{ stats.downloads }}</strong><span>prints</span></div>
        </section>

        <div class="admin-toolbar">
          <UiSegmented v-model="status" :options="statusOptions" aria-label="Filter" />
          <label class="admin-search">
            <UiIcon name="search" />
            <input v-model="query" type="search" placeholder="Title, author, tag or id" aria-label="Search" />
          </label>
          <div class="select admin-sort">
            <select v-model="sort" aria-label="Sort">
              <option value="new">Newest first</option>
              <option value="reports">Most reported</option>
              <option value="likes">Most liked</option>
            </select>
            <UiIcon name="chevron-down" class="select__chevron" />
          </div>
          <button type="button" class="btn btn--icon" aria-label="Reload" data-tip="Reload" @click="load()">
            <UiIcon name="refresh" :class="{ spin: loading }" />
          </button>
        </div>

        <p v-if="error" class="notice notice--danger"><UiIcon name="alert" /><span>{{ error }}</span></p>

        <div class="admin-list">
          <DesignRow
            v-for="design in items"
            :key="design.id"
            :design="design"
            :busy="busyId === design.id"
            @update="update(design, $event)"
            @delete="remove(design)"
          />
          <div v-if="!loading && !items.length && !error" class="admin-empty">
            <span aria-hidden="true">{{ status === 'reported' ? '☕' : '🧺' }}</span>
            <p>{{ status === 'reported' ? 'No open reports. All quiet.' : status === 'hidden' ? 'No hidden designs.' : 'No designs found.' }}</p>
          </div>
        </div>

        <div v-if="items.length < total" class="admin-more">
          <button type="button" class="btn" :disabled="loading" @click="load(true)">
            <UiIcon :name="loading ? 'loader' : 'chevron-down'" :class="{ spin: loading }" />
            <span>Show more ({{ total - items.length }})</span>
          </button>
        </div>
      </main>
    </template>

    <ToastHost />
  </div>
</template>

<script setup lang="ts">
/**
 * Moderation page (/admin). Everything here goes through /api/admin/*, which the server only
 * answers with the right ADMIN_TOKEN; the page itself holds no data.
 */
import { computed, ref, watch } from 'vue';
import ToastHost from '@/core/components/ToastHost.vue';
import UiIcon from '@/core/components/ui/UiIcon.vue';
import UiSegmented from '@/core/components/ui/UiSegmented.vue';
import { useTheme } from '@/core/composables/useTheme';
import { toast } from '@/core/composables/useToasts';
import siteConfig from '@/site.config';
import {
  AdminError, deleteDesign, listDesigns, signIn, signOut, token, updateDesign,
  type AdminDesign, type AdminSort, type AdminStats, type AdminStatus,
} from './api';
import DesignRow from './DesignRow.vue';

const isDev = import.meta.env.DEV;
const { state: theme, toggleTheme } = useTheme();
const themeLabel = computed(() => (theme.theme === 'dark' ? 'Light theme' : 'Dark theme'));

/* ---------- sign in ---------- */

const tokenInput = ref('');
const signingIn = ref(false);
const loginError = ref('');

const describe = (error: unknown) => {
  const code = error instanceof AdminError ? error.message : 'server_error';
  return {
    unauthorized: 'That token is not valid.',
    rate_limited: 'Too many attempts. Wait 15 minutes and try again.',
    admin_disabled: 'Moderation is disabled: set ADMIN_TOKEN on the server.',
    offline: 'The server is not reachable.',
  }[code] ?? `Something went wrong (${code}).`;
};

const submit = async () => {
  signingIn.value = true;
  loginError.value = '';
  try {
    await signIn(tokenInput.value.trim());
    tokenInput.value = '';
  } catch (cause) {
    loginError.value = describe(cause);
  } finally {
    signingIn.value = false;
  }
};

const logout = () => {
  signOut();
  items.value = [];
  stats.value = null;
};

/* ---------- list ---------- */

const status = ref<AdminStatus>('reported');
const sort = ref<AdminSort>('new');
const query = ref('');
const items = ref<AdminDesign[]>([]);
const total = ref(0);
const stats = ref<AdminStats | null>(null);
const loading = ref(false);
const error = ref('');
const busyId = ref<string | null>(null);
let request = 0;
let searchTimer = 0;

const statusOptions = computed(() => [
  { value: 'reported' as const, label: `Reported${stats.value?.reported ? ` (${stats.value.reported})` : ''}`, icon: 'flag' },
  { value: 'hidden' as const, label: 'Hidden', icon: 'eye' },
  { value: 'all' as const, label: 'All', icon: 'layout-grid' },
]);

const load = async (more = false) => {
  if (!token.value) return;
  request += 1;
  const current = request;
  loading.value = true;
  error.value = '';
  try {
    const result = await listDesigns({
      status: status.value, q: query.value, sort: sort.value, offset: more ? items.value.length : 0,
    });
    if (current !== request) return;
    items.value = more ? [...items.value, ...result.items] : result.items;
    total.value = result.total;
    stats.value = result.stats;
  } catch (cause) {
    if (current === request) error.value = describe(cause);
  } finally {
    if (current === request) loading.value = false;
  }
};

/** a design that no longer matches the filter leaves the list */
const matchesFilter = (design: AdminDesign) => (status.value === 'reported' ? design.reports > 0 && !design.hidden
  : status.value === 'hidden' ? design.hidden : true);

const refreshStats = async () => {
  stats.value = (await listDesigns({
    status: 'all', q: '', sort: 'new', offset: 0,
  }).catch(() => null))?.stats ?? stats.value;
};

const update = async (design: AdminDesign, change: { hidden?: boolean; clearReports?: boolean }) => {
  busyId.value = design.id;
  try {
    const updated = await updateDesign(design.id, change);
    const index = items.value.findIndex((item) => item.id === design.id);
    if (matchesFilter(updated)) {
      items.value.splice(index, 1, updated);
    } else {
      items.value.splice(index, 1);
      total.value -= 1;
    }
    toast({
      type: 'success',
      message: change.hidden === true ? `"${design.title}" is hidden.` : change.hidden === false ? `"${design.title}" is visible again.` : 'Reports dismissed.',
    });
    refreshStats();
  } catch (cause) {
    toast({ type: 'error', message: describe(cause) });
  } finally {
    busyId.value = null;
  }
};

const remove = async (design: AdminDesign) => {
  if (!window.confirm(`Delete "${design.title}" for good? This cannot be undone.`)) return;
  busyId.value = design.id;
  try {
    await deleteDesign(design.id);
    items.value = items.value.filter((item) => item.id !== design.id);
    total.value -= 1;
    toast({ type: 'success', icon: 'trash', message: `"${design.title}" was deleted.` });
    refreshStats();
  } catch (cause) {
    toast({ type: 'error', message: describe(cause) });
  } finally {
    busyId.value = null;
  }
};

watch([status, sort], () => load());
watch(query, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => load(), 250);
});
watch(token, (value) => {
  if (value) load();
}, { immediate: true });
</script>

<style scoped>
.admin {
  min-height: 100vh;
}

.admin-login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
}

.admin-login__card {
  display: grid;
  justify-items: center;
  gap: 14px;
  width: min(400px, 100%);
  padding: 32px 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.admin-login__card h1 {
  margin: 0;
  color: var(--text);
  font-size: 22px;
}

.admin-login__card p {
  margin: 0;
}

.admin-login__card .input,
.admin-login__card .btn,
.admin-login__card .notice {
  width: 100%;
}

.admin-header {
  position: sticky;
  z-index: 20;
  top: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-height);
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(14px);
}

.admin-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-weight: 700;
}

.admin-header__brand:hover {
  text-decoration: none;
}

.admin-header__title {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12.5px;
  font-weight: 650;
}

.admin-header__spacer {
  flex: 1 1 auto;
}

.admin-main {
  display: grid;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}

.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.admin-stat {
  display: grid;
  gap: 2px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.admin-stat strong {
  color: var(--text);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.admin-stat span {
  color: var(--text-3);
  font-size: 13px;
}

.admin-stat.is-alert {
  border-color: var(--warning-border);
  background: var(--warning-soft);
}

.admin-stat.is-alert strong {
  color: var(--warning-text);
}

.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.admin-search {
  display: flex;
  flex: 1 1 220px;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-3);
}

.admin-search:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.admin-search input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
}

.admin-sort select {
  width: 170px;
  height: 40px;
}

.admin-list {
  display: grid;
  gap: 10px;
}

.admin-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 56px 16px;
  color: var(--text-2);
}

.admin-empty span {
  font-size: 40px;
}

.admin-empty p {
  margin: 0;
}

.admin-more {
  display: flex;
  justify-content: center;
}
</style>
