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

export const mvpDocsSseEmitter = new SSEEmitter();
