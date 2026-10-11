import type { Directive } from 'vue';

type AutosizeElement = HTMLTextAreaElement & {
  autosizeHandler?: () => void;
  autosizeEmptyHeight?: number;
};

const resize = (el: AutosizeElement) => {
  if (!el.isConnected) {
    return;
  }
  el.style.height = 'auto';
  const borders = el.offsetHeight - el.clientHeight;
  const maxHeight = parseFloat(window.getComputedStyle(el).maxHeight) || Infinity;
  let height = el.scrollHeight + borders;
  // Remember the height needed by the (possibly wrapping) placeholder, so the field
  // does not shrink and shift the layout as soon as the user starts typing.
  if (!el.value) {
    el.autosizeEmptyHeight = height;
  } else if (el.autosizeEmptyHeight) {
    height = Math.max(height, el.autosizeEmptyHeight);
  }
  el.style.height = `${Math.min(height, maxHeight)}px`;
};

/** v-autosize: grows a textarea with its content (up to its CSS max-height). */
const vAutosize: Directive<AutosizeElement> = {
  mounted(el) {
    el.autosizeHandler = () => resize(el);
    el.addEventListener('input', el.autosizeHandler);
    window.requestAnimationFrame(() => resize(el));
  },
  updated(el) {
    resize(el);
  },
  unmounted(el) {
    if (el.autosizeHandler) {
      el.removeEventListener('input', el.autosizeHandler);
    }
  },
};

export default vAutosize;
