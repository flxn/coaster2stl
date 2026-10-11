import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ModelWarning } from '../types';
import { useWorkbench, type Workbench } from './useWorkbench';

export interface DescribedWarning {
  code: string;
  label: string;
  help: string;
}

/**
 * Texts for the warnings of the last generated model. A warning with code `x` uses the
 * i18n keys `warnings.x` (short label) and `warnings.xHelp` (explanation).
 * Pass the workbench only in the component that provides it (inject does not see its own provide).
 */
export const useModelWarnings = (workbench: Workbench = useWorkbench()) => {
  const { t, te } = useI18n();

  const describe = (warning: ModelWarning): DescribedWarning => {
    const key = `warnings.${warning.code}`;
    const params = warning.params || {};
    return {
      code: warning.code,
      label: te(key) ? t(key, params) : warning.code,
      help: te(`${key}Help`) ? t(`${key}Help`, params) : '',
    };
  };

  const described = computed(() => (workbench.hasModel.value ? workbench.warnings.value.map(describe) : []));

  /** Hint for a setting, e.g. `:warning="warningFor('radiusLimited')"` on a UiNumberField. */
  const warningFor = (...codes: string[]): string => {
    const warning = described.value.find((item) => codes.includes(item.code));
    return warning ? [warning.label, warning.help].filter(Boolean).join('. ') : '';
  };

  return { warnings: described, warningFor };
};
