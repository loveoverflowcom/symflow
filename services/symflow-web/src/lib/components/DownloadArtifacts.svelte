<script lang="ts">
  import { collectDownloadArtifacts, type DownloadArtifact } from '$lib/utils/artifacts';

  let { value } = $props<{ value: unknown }>();

  const artifacts = $derived(collectDownloadArtifacts(value));

  function downloadCsv(artifact: Extract<DownloadArtifact, { kind: 'csv' }>) {
    const blob = new Blob([artifact.csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, artifact.filename);
  }

  function downloadPdf(artifact: Extract<DownloadArtifact, { kind: 'pdf' }>) {
    const bytes = base64ToBytes(artifact.contentBase64);
    const blob = new Blob([bytesToArrayBuffer(bytes)], { type: 'application/pdf' });
    downloadBlob(blob, artifact.filename);
  }

  function downloadDocx(artifact: Extract<DownloadArtifact, { kind: 'docx' }>) {
    const bytes = base64ToBytes(artifact.contentBase64);
    const blob = new Blob([bytesToArrayBuffer(bytes)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    downloadBlob(blob, artifact.filename);
  }

  function base64ToBytes(content: string): Uint8Array {
    const base64 = content.includes(',') && /^data:/i.test(content)
      ? content.slice(content.indexOf(',') + 1)
      : content;
    return Uint8Array.from(atob(base64.replace(/\s+/g, '')), (char) => char.charCodeAt(0));
  }

  function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
</script>

{#if artifacts.length > 0}
  <div class="download-artifacts">
    {#each artifacts as artifact}
      {#if artifact.kind === 'csv'}
        <button class="secondary-button" type="button" onclick={() => downloadCsv(artifact)}>
          Tải CSV: {artifact.filename}
        </button>
      {:else if artifact.kind === 'pdf'}
        <button class="secondary-button" type="button" onclick={() => downloadPdf(artifact)}>
          Tải PDF: {artifact.filename}
        </button>
      {:else}
        <button class="secondary-button" type="button" onclick={() => downloadDocx(artifact)}>
          Tải DOCX: {artifact.filename}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .download-artifacts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
  }
</style>
