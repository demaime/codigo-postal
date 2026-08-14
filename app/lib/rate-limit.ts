/**
 * Token bucket en memoria, por IP.
 *
 * Las APIs que hay detrás son servicios públicos y gratuitos con cuota
 * compartida: una pestaña con el dedo apoyado en Enter no puede quemarles el
 * presupuesto a todos. Cada ruta crea su propio limitador porque no cuestan lo
 * mismo — el autocompletado pega contra georef (sin límite declarado) y la
 * resolución del código postal contra Nominatim (máximo 1 req/s).
 */

type Bucket = { tokens: number; updatedAt: number };

type RateLimiterOptions = {
  capacity: number;
  refillPerSecond: number;
  /** Se descartan los baldes inactivos para que el Map no crezca sin techo. */
  ttlMs?: number;
  maxBuckets?: number;
};

export type RateLimiter = {
  take: (key: string, now?: number) => boolean;
};

export function createRateLimiter({
  capacity,
  refillPerSecond,
  ttlMs = 5 * 60 * 1000,
  maxBuckets = 500,
}: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function prune(now: number) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.updatedAt > ttlMs) buckets.delete(key);
    }
  }

  return {
    take(key: string, now = Date.now()): boolean {
      const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
      const elapsedSeconds = (now - bucket.updatedAt) / 1000;

      const tokens = Math.min(
        capacity,
        bucket.tokens + elapsedSeconds * refillPerSecond,
      );

      if (tokens < 1) {
        buckets.set(key, { tokens, updatedAt: now });
        return false;
      }

      buckets.set(key, { tokens: tokens - 1, updatedAt: now });
      if (buckets.size > maxBuckets) prune(now);
      return true;
    },
  };
}

/** Identifica al cliente detrás del proxy de Vercel. */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
