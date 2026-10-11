import type { Component } from 'vue';

export interface FaqEntry {
  /** i18n key of the question */
  question: string;
  /** i18n key of the answer (plain text) */
  answer: string;
}

/**
 * What a tool plugs into the workbench. The geometry lives separately in `src/tool/generator.ts`
 * because it runs in the model worker and must not import Vue.
 */
export interface ToolDefinition<Options extends object> {
  /** initial settings; also used to tell which fields are numbers (see hasValidNumbers) */
  defaultOptions: Options;
  /** whether the preview may update automatically, e.g. only once the required content is filled in */
  isReadyForUpdate: (options: Options) => boolean;
  /**
   * Repairs settings that came from outside (saved settings, imported files), e.g. unknown list
   * entries or enum values that no longer exist. Runs after the values were merged into the defaults.
   */
  normalizeOptions?: (options: Options) => void;
  /** sidebar with all settings; it reads and edits them with useToolOptions() */
  panel: Component;
  /** questions shown in the FAQ section below the workbench */
  faq: FaqEntry[];
  /** extra buttons in the header, before the settings button (e.g. a gallery) */
  headerActions?: Component;
  /** extra buttons at the end of the 3D view toolbar (use the `tool-button` class) */
  viewportActions?: Component;
  /** extra content below the workbench, before the print guide */
  infoSection?: Component;
}

export const defineTool = <Options extends object>(tool: ToolDefinition<Options>): ToolDefinition<Options> => tool;
