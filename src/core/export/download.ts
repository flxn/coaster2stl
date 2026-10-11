/** Saves a blob as a file download. */
export const saveBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // give the browser time to start the download before the URL is released
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export const saveText = (text: string, filename: string, type = 'text/plain'): void => {
  saveBlob(new Blob([text], { type }), filename);
};
