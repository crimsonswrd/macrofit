const targetMutationTails = new Map<string, Promise<void>>();

/** Serializes target-appending decisions for one user within this server process. */
export async function withTargetMutationLock<T>(userId: { toString(): string }, task: () => Promise<T>): Promise<T> {
  const key = userId.toString();
  const previous = targetMutationTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  targetMutationTails.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (targetMutationTails.get(key) === tail) targetMutationTails.delete(key);
  }
}
