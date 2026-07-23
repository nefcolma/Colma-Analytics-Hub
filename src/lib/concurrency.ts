/** Minimal promise-concurrency limiter (p-limit style, no dependency). */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    active--;
    queue.shift()?.();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn().then(resolve, reject).finally(next);
      };
      if (active < max) run();
      else queue.push(run);
    });
  };
}

/** Map over items with bounded concurrency, preserving order. */
export async function mapWithLimit<T, R>(
  items: T[],
  max: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = createLimiter(max);
  return Promise.all(items.map((item, i) => limit(() => fn(item, i))));
}
