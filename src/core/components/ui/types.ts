export interface SegmentedOption<V> {
  value: V;
  label?: string;
  /** key of icons.ts */
  icon?: string;
  /** tooltip */
  tip?: string;
  title?: string;
  disabled?: boolean;
}

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
}
