export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Label of the modifier key used in shortcuts (⌘ on Apple devices, Ctrl elsewhere). */
export const modifierKey = isMac ? '⌘' : 'Ctrl';
