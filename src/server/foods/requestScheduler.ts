export const OFF_REQUEST_SPACING_MS = 4_000;
export const OFF_MAX_RETRY_AFTER_MS = 30_000;

export type SchedulerClock = {
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
};

const systemClock: SchedulerClock = {
  now: () => Date.now(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

/** Serial scheduler: globally stricter than the OFF limit of 15 requests/minute/IP. */
export class ExternalRequestScheduler {
  private queue: Promise<void> = Promise.resolve();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private notBefore = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly clock: SchedulerClock = systemClock,
    private readonly spacingMs = OFF_REQUEST_SPACING_MS,
  ) {}

  defer(milliseconds: number) {
    const bounded = Math.max(this.spacingMs, Math.min(milliseconds, OFF_MAX_RETRY_AFTER_MS));
    this.notBefore = Math.max(this.notBefore, this.clock.now() + bounded);
  }

  schedule<T>(
    key: string,
    task: () => Promise<T>,
    retryDelay: (error: unknown) => number | null = () => null,
  ): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const request = this.enqueue(task)
      .catch((error: unknown) => {
        const delay = retryDelay(error);
        if (delay === null) throw error;
        this.defer(delay);
        return this.enqueue(task);
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const request = this.queue.then(async () => {
      const earliest = Math.max(this.lastStartedAt + this.spacingMs, this.notBefore);
      const delay = Math.max(0, earliest - this.clock.now());
      if (delay > 0) await this.clock.sleep(delay);
      this.lastStartedAt = this.clock.now();
      this.notBefore = Number.NEGATIVE_INFINITY;
      return task();
    });
    this.queue = request.then(
      () => undefined,
      () => undefined,
    );
    return request;
  }
}
