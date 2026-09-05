/** Build the native window title from the current document state. */
export function documentDisplayName(
  path: string | null,
  rootText: string,
  untitled: string,
): string {
  if (path) return path.split(/[\\/]/).pop() || path;
  return rootText.trim() || untitled;
}

export function buildDocumentTitle(
  path: string | null,
  rootText: string,
  isDirty: boolean,
  appName: string,
  untitled: string,
): string {
  const dirtyPrefix = isDirty ? '* ' : '';
  return `${dirtyPrefix}${documentDisplayName(path, rootText, untitled)} · ${appName}`;
}
