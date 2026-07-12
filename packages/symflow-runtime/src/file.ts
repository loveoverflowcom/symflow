/**
 * A file accepted by a workflow input.
 *
 * Declare an input as `WorkflowFile` to render a file picker in the run form.
 * Tasks should use the resolvers below instead of inspecting this union.
 */
export type WorkflowFile = File | Blob | string;

/** Resolves a workflow file to a Blob, fetching URL and data-URL strings. */
export async function resolveFileAsBlob(file: WorkflowFile): Promise<Blob> {
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    return file;
  }

  const { toBlob } = await import('./ocr/preprocess');
  return toBlob(file);
}

/**
 * Resolves a workflow file to a URL. Revoke the returned URL when
 * `shouldRevoke` is true.
 */
export function resolveFileAsUrl(file: WorkflowFile): { url: string; shouldRevoke: boolean } {
  if (typeof file === 'string') {
    return { url: file, shouldRevoke: false };
  }

  return { url: URL.createObjectURL(file), shouldRevoke: true };
}

/** Returns whether a value is a non-empty file URL/string, File, or Blob. */
export function isWorkflowFile(value: unknown): value is WorkflowFile {
  return (typeof value === 'string' && value.length > 0)
    || (typeof Blob !== 'undefined' && value instanceof Blob);
}
