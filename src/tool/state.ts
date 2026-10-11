import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from '@/core/composables/useToasts';
import { useWorkbench } from '@/core/composables/useWorkbench';
import {
  ApiError, countDownload, getDesign, setLiked, type GalleryDesign,
} from './api';
import { normalizeOptions, type ToolOptions } from './options';

/**
 * State shared by the coaster's components: the gallery and share dialogs, the design that was
 * opened from the gallery (to mark remixes and count prints) and the preview mug.
 */
export const coasterState = reactive({
  galleryOpen: false,
  shareOpen: false,
  sketchpadOpen: false,
  /** design opened in the gallery's detail view */
  detailId: null as string | null,
  /** the published design the current settings came from */
  loaded: null as (Pick<GalleryDesign, 'id' | 'title' | 'author'> & { signature: string }) | null,
  /** bumped after publishing, so lists reload */
  galleryVersion: 0,
  /** the preview mug starts hidden on every visit */
  showMug: false,
});

/** Path of a shared design (/d/<id> or /de/d/<id>), if the page was opened through a share link. */
export const sharedDesignId = (): string | null => {
  const match = /^(?:\/[a-z]{2})?\/d\/([a-z0-9]{6,16})\/?$/.exec(window.location.pathname);
  return match ? match[1] : null;
};

/** Settings in a stable form for comparing (key order and NaN as null, like the workbench). */
const signatureOf = (options: unknown) => JSON.stringify(options);

let exportHookInstalled = false;

/** Loads published designs into the workbench and keeps track of what was loaded. */
export const useDesignLoader = () => {
  const { t } = useI18n();
  const workbench = useWorkbench();
  const options = workbench.options as ToolOptions;

  const isUnchanged = () => !!coasterState.loaded && coasterState.loaded.signature === signatureOf(workbench.exportOptions());

  const loadDesign = async (id: string, { quiet = false } = {}) => {
    try {
      const design = await getDesign(id);
      const previous = workbench.replaceOptions(design.options);
      // nullable fields are not overwritten by the merge; take them over explicitly
      options.artwork.icon = design.options.artwork?.icon ?? null;
      options.artwork.upload = design.options.artwork?.upload ?? null;
      normalizeOptions(options);
      coasterState.loaded = {
        id: design.id, title: design.title, author: design.author, signature: signatureOf(workbench.exportOptions()),
      };
      workbench.generate();
      if (!quiet) {
        toast({
          type: 'success',
          icon: 'download',
          message: t('tool.gallery.loaded', { title: design.title }),
          action: {
            label: t('undo'),
            run: () => {
              workbench.replaceOptions(previous);
              const old = previous as ToolOptions;
              options.artwork.icon = old.artwork?.icon ?? null;
              options.artwork.upload = old.artwork?.upload ?? null;
              coasterState.loaded = null;
            },
          },
        });
      }
      return design;
    } catch (error) {
      toast({ type: 'error', message: error instanceof ApiError && error.status === 404 ? t('tool.gallery.notFound') : t('tool.gallery.offline') });
      return null;
    }
  };

  // count a print when a gallery design is exported unchanged
  if (!exportHookInstalled) {
    exportHookInstalled = true;
    workbench.onExport((kind) => {
      if (kind === 'stl' && coasterState.loaded && isUnchanged()) {
        countDownload(coasterState.loaded.id);
      }
    });
  }

  return { loadDesign, isUnchanged };
};

/** Likes or unlikes a design right away and syncs with the server (reverted when that fails). */
export const toggleLike = async (design: GalleryDesign, failedMessage: string) => {
  const liked = !design.liked;
  design.liked = liked;
  design.likes += liked ? 1 : -1;
  try {
    const result = await setLiked(design.id, liked);
    design.likes = result.likes;
    design.liked = result.liked;
  } catch {
    design.liked = !liked;
    design.likes += liked ? -1 : 1;
    toast({ type: 'error', message: failedMessage });
  }
};
