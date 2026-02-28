/** Derive accept string for images only */
export function getAcceptImages(acceptedTypes: Record<string, string[]>): string {
  return Object.entries(acceptedTypes)
    .filter(([mime]) => mime.startsWith("image/"))
    .flatMap(([, exts]) => exts)
    .join(",");
}

/** Derive accept string for non-image files only */
export function getAcceptFiles(acceptedTypes: Record<string, string[]>): string {
  return Object.entries(acceptedTypes)
    .filter(([mime]) => !mime.startsWith("image/"))
    .flatMap(([, exts]) => exts)
    .join(",");
}

/** Derive accept string for all file types */
export function getAcceptAll(acceptedTypes: Record<string, string[]>): string {
  return Object.values(acceptedTypes).flat().join(",");
}
