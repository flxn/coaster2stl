import { defineTool } from '@/core/tool';
import GalleryStrip from './components/GalleryStrip.vue';
import HeaderActions from './components/HeaderActions.vue';
import MugToggle from './components/MugToggle.vue';
import faq from './faq';
import { defaultOptions, isReadyForUpdate, normalizeOptions } from './options';
import ToolPanel from './ToolPanel.vue';

/**
 * The coaster tool: settings (options.ts), geometry (generator.ts), sidebar (ToolPanel.vue),
 * and the community gallery (header buttons and the strip below the workbench).
 */
export default defineTool({
  defaultOptions,
  isReadyForUpdate,
  normalizeOptions,
  panel: ToolPanel,
  faq,
  headerActions: HeaderActions,
  viewportActions: MugToggle,
  infoSection: GalleryStrip,
});
