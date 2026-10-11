<template>
  <div ref="anchor" class="popover-anchor">
    <slot name="trigger" :open="open" :toggle="toggle" :close="close" />
    <Teleport to="body">
      <Transition name="popover">
        <div
          v-if="open"
          ref="panel"
          class="popover"
          :class="panelClass"
          :style="panelStyle"
          :role="role"
          @keydown="onKeydown"
          @click="onPanelClick"
        >
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * Menu / popover anchored to its trigger. The panel is teleported to <body>, so it is never
 * clipped or mispositioned by a parent with overflow, transforms or backdrop filters.
 */
import {
  nextTick, onBeforeUnmount, ref, useTemplateRef,
} from 'vue';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

const props = withDefaults(defineProps<{
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  offset?: number;
  width?: number;
  panelClass?: string;
  role?: string;
  closeOnItemClick?: boolean;
}>(), {
  placement: 'bottom-start',
  offset: 8,
  width: undefined,
  panelClass: '',
  role: 'menu',
  closeOnItemClick: true,
});

const emit = defineEmits<{ open: []; close: [] }>();

const open = ref(false);
const panelStyle = ref<Record<string, string | undefined>>({});
const anchor = useTemplateRef<HTMLDivElement>('anchor');
const panel = useTemplateRef<HTMLDivElement>('panel');

const position = () => {
  if (!anchor.value || !panel.value) {
    return;
  }
  const rect = anchor.value.getBoundingClientRect();
  const panelWidth = props.width || panel.value.offsetWidth;
  const panelHeight = panel.value.offsetHeight;
  const [side, align] = props.placement.split('-');
  const margin = 8;

  let left = align === 'end' ? rect.right - panelWidth : rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

  let top = side === 'top' ? rect.top - panelHeight - props.offset : rect.bottom + props.offset;
  let originY = side === 'top' ? 'bottom' : 'top';
  if (side !== 'top' && top + panelHeight > window.innerHeight - margin && rect.top - panelHeight - props.offset > margin) {
    top = rect.top - panelHeight - props.offset;
    originY = 'bottom';
  } else if (side === 'top' && top < margin) {
    top = rect.bottom + props.offset;
    originY = 'top';
  }

  panelStyle.value = {
    top: `${Math.max(margin, top)}px`,
    left: `${left}px`,
    width: props.width ? `${props.width}px` : undefined,
    '--popover-origin': `${originY} ${align === 'end' ? 'right' : 'left'}`,
  };
};

const items = () => (panel.value ? Array.from(panel.value.querySelectorAll<HTMLElement>('.menu-item, [data-popover-item]')) : []);

const focusItem = (index: number) => {
  const list = items();
  if (!list.length) {
    panel.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return;
  }
  list[(index + list.length) % list.length].focus();
};

const onOutside = (event: PointerEvent) => {
  const target = event.target as Node;
  if (anchor.value?.contains(target) || panel.value?.contains(target)) {
    return;
  }
  close();
};

const onDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close(true);
  }
};

const unbind = () => {
  document.removeEventListener('pointerdown', onOutside, true);
  document.removeEventListener('keydown', onDocumentKeydown);
  window.removeEventListener('resize', position);
  window.removeEventListener('scroll', position, true);
};

function close(restoreFocus = false) {
  if (!open.value) {
    return;
  }
  open.value = false;
  emit('close');
  unbind();
  if (restoreFocus) {
    anchor.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }
}

const show = (focusFirst = false) => {
  open.value = true;
  emit('open');
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  nextTick(() => {
    position();
    if (focusFirst) {
      focusItem(0);
    }
  });
};

const toggle = (event?: MouseEvent) => {
  if (open.value) {
    close();
  } else {
    // keyboard activation (detail 0) moves focus into the menu
    show(event?.detail === 0);
  }
};

const onPanelClick = (event: MouseEvent) => {
  if (props.closeOnItemClick && (event.target as HTMLElement).closest('.menu-item')) {
    close();
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return;
  }
  const list = items();
  if (!list.length) {
    return;
  }
  event.preventDefault();
  const current = list.indexOf(document.activeElement as HTMLElement);
  focusItem(current + (event.key === 'ArrowDown' ? 1 : -1));
};

onBeforeUnmount(unbind);
</script>

<style>
.popover-anchor {
  position: relative;
  display: inline-flex;
}
</style>
