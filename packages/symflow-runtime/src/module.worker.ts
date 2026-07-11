self.onmessage = async (event: MessageEvent<{ source: string }>) => {
  const url = URL.createObjectURL(
    new Blob([event.data.source], { type: 'text/javascript' })
  );
  try {
    const module = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    if (!Object.prototype.hasOwnProperty.call(module, 'default')) {
      throw new Error('Run input module must export default input');
    }
    postMessage({ type: 'complete', output: module.default });
  } catch (error) {
    postMessage({
      type: 'failed',
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};
