import { reactive, readonly } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  /** icon name (see ui/icons.ts); defaults to one per type */
  icon?: string;
  /** milliseconds until the toast disappears */
  timeout?: number;
  /** a button in the toast, e.g. to undo what was just done */
  action?: { label: string; run: () => void };
}

export interface Toast extends Required<Omit<ToastOptions, 'icon' | 'action'>> {
  id: number;
  icon?: string;
  action?: ToastOptions['action'];
}

const MAX_TOASTS = 4;
const toasts = reactive<Toast[]>([]);
const timers = new Map<number, number>();
let nextId = 1;

const dismiss = (id: number) => {
  window.clearTimeout(timers.get(id));
  timers.delete(id);
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) {
    toasts.splice(index, 1);
  }
};

const pause = (id: number) => window.clearTimeout(timers.get(id));

const resume = (id: number) => {
  const toast = toasts.find((item) => item.id === id);
  if (!toast) {
    return;
  }
  window.clearTimeout(timers.get(id));
  timers.set(id, window.setTimeout(() => dismiss(id), toast.timeout));
};

/** Shows a short notification above the preview. */
export const toast = (options: ToastOptions | string): void => {
  const {
    message, type = 'info', icon, timeout, action,
  } = typeof options === 'string' ? { message: options } as ToastOptions : options;
  // collapse identical messages instead of stacking duplicates
  toasts.filter((existing) => existing.message === message).forEach((existing) => dismiss(existing.id));
  const id = nextId;
  nextId += 1;
  toasts.push({
    id, message, type, icon, action, timeout: timeout ?? (type === 'error' || action ? 6000 : 3200),
  });
  if (toasts.length > MAX_TOASTS) {
    dismiss(toasts[0].id);
  }
  resume(id);
};

export const useToasts = () => ({
  toasts: readonly(toasts),
  dismiss,
  pause,
  resume,
});
