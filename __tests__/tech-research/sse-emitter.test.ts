import { describe, it, expect, vi, beforeEach } from "vitest";
import { techSseEmitter } from "@/lib/tech-research/store/sse-emitter";

describe("techSseEmitter", () => {
  beforeEach(() => {
    // Clean up any lingering subscriptions between tests by using unique job IDs
  });

  it("delivers events to a subscriber", () => {
    const jobId = "test-job-1";
    const received: { event: string; data: object }[] = [];
    const unsubscribe = techSseEmitter.subscribe(jobId, (event, data) => {
      received.push({ event, data });
    });

    techSseEmitter.emit(jobId, "status", { status: "running" });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ event: "status", data: { status: "running" } });

    unsubscribe();
  });

  it("delivers to all subscribers for the same job", () => {
    const jobId = "test-job-2";
    const calls: number[] = [];
    const unsub1 = techSseEmitter.subscribe(jobId, () => calls.push(1));
    const unsub2 = techSseEmitter.subscribe(jobId, () => calls.push(2));

    techSseEmitter.emit(jobId, "agent_update", { agentId: "req-analyzer" });
    expect(calls).toContain(1);
    expect(calls).toContain(2);

    unsub1();
    unsub2();
  });

  it("does not deliver to subscribers of a different job", () => {
    const jobA = "job-a";
    const jobB = "job-b";
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const unsubA = techSseEmitter.subscribe(jobA, (e) => receivedA.push(e));
    const unsubB = techSseEmitter.subscribe(jobB, (e) => receivedB.push(e));

    techSseEmitter.emit(jobA, "complete", {});
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);

    unsubA();
    unsubB();
  });

  it("stops delivering after unsubscribe", () => {
    const jobId = "test-job-3";
    const received: unknown[] = [];
    const unsubscribe = techSseEmitter.subscribe(jobId, (e) => received.push(e));

    techSseEmitter.emit(jobId, "status", { status: "running" });
    expect(received).toHaveLength(1);

    unsubscribe();
    techSseEmitter.emit(jobId, "complete", {});
    expect(received).toHaveLength(1); // no new events after unsub
  });

  it("cleans up the subscriber set after last subscriber unsubscribes", () => {
    const jobId = "test-job-4";
    const fn = vi.fn();
    const unsubscribe = techSseEmitter.subscribe(jobId, fn);
    unsubscribe();

    // Emitting after all unsubs should not call anything
    techSseEmitter.emit(jobId, "status", {});
    expect(fn).not.toHaveBeenCalled();
  });

  it("passes event name and data object to subscriber", () => {
    const jobId = "test-job-5";
    const fn = vi.fn();
    const unsubscribe = techSseEmitter.subscribe(jobId, fn);

    const payload = { agentId: "arch-synthesizer", status: "done", note: "3 phases" };
    techSseEmitter.emit(jobId, "agent_update", payload);

    expect(fn).toHaveBeenCalledWith("agent_update", payload);
    unsubscribe();
  });

  it("handles emit with no subscribers without throwing", () => {
    expect(() => {
      techSseEmitter.emit("nonexistent-job", "status", {});
    }).not.toThrow();
  });

  it("supports multiple event types on the same subscription", () => {
    const jobId = "test-job-6";
    const events: string[] = [];
    const unsubscribe = techSseEmitter.subscribe(jobId, (e) => events.push(e));

    techSseEmitter.emit(jobId, "status", {});
    techSseEmitter.emit(jobId, "agent_update", {});
    techSseEmitter.emit(jobId, "complete", {});

    expect(events).toEqual(["status", "agent_update", "complete"]);
    unsubscribe();
  });
});
