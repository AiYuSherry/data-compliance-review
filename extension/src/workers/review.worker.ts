import { runReviewPipeline } from '../engine/review';

self.onmessage = async (event: MessageEvent) => {
  if (event.data?.type !== 'run-review') return;

  try {
    const bundle = await runReviewPipeline({
      documentName: event.data.documentName,
      source: event.data.source,
      settings: event.data.settings,
      onProgress(progress) {
        self.postMessage({ type: 'progress', progress });
      }
    });
    self.postMessage({ type: 'completed', bundle });
  } catch (error) {
    self.postMessage({
      type: 'failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
