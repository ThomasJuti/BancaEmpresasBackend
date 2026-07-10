/**
 * Aplica `fn` a cada item con un máximo de `limit` ejecuciones concurrentes.
 * Preserva el orden de los resultados. Útil para limitar llamadas HTTP salientes.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
