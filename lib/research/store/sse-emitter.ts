/**
 * In-process SSE event bus.
 *
 * In development (single Node.js process) this works perfectly.
 * In production on Vercel, the research job and the SSE status stream may run
 * in different function instances, so the subscriber would never receive events.
 *
 * The SSE status route handles this gracefully by also polling the job store
 * every 2 seconds as a fallback — so the client always gets updates even when
 * the in-process emitter is a no-op.
 */

type Subscriber = (event: string, data: object) => void;

class SSEEmitter {
  private subscribers = new Map<string, Set<Subscriber>>();

  subscribe(jobId: string, callback: Subscriber): () => void {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    this.subscribers.get(jobId)!.add(callback);
    return () => {
      this.subscribers.get(jobId)?.delete(callback);
      if (this.subscribers.get(jobId)?.size === 0) {
        this.subscribers.delete(jobId);
      }
    };
  }

  emit(jobId: string, event: string, data: object): void {
    this.subscribers.get(jobId)?.forEach((cb) => cb(event, data));
  }
}

export const sseEmitter = new SSEEmitter();
