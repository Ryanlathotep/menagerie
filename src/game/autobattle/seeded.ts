/**
 * Seeded mulberry32 RNG used by the autobattle resolver so match results
 * are deterministic given a seed. Same family as the dungeon seeding RNG
 * (mulberry32) to keep the mental model consistent across the codebase.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run `fn` with `Math.random` temporarily replaced by `rng`.
 *
 * This lets the resolver reuse every existing combat.ts / enemyAI.ts helper
 * (which call `Math.random()` directly) without touching that code.
 *
 * The swap is stack-safe: nested `withSeededRandom` calls restore correctly
 * because we always restore to whatever `Math.random` was on entry, not to
 * the global native one.
 */
export function withSeededRandom<T>(rng: () => number, fn: () => T): T {
  const original = Math.random;
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
