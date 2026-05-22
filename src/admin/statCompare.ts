// Small shared helpers used by the admin editors to surface "how does this
// thing compare to the rest of the pool?" stats — mirrors what MovesEditor
// already does for moves, so monster / equipment tuning has the same feel.

export interface NumericFieldStats {
  min: number;
  max: number;
  avg: number;
}

export function computeTrimmedStats(values: number[]): NumericFieldStats {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return { min: 0, max: 0, avg: 0 };
  const trim = Math.floor(clean.length * 0.1);
  const trimmed = trim * 2 < clean.length ? clean.slice(trim, clean.length - trim) : clean;
  const avg = Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length);
  return { min: trimmed[0], max: trimmed[trimmed.length - 1], avg };
}

export function formatNumericHint(stats: NumericFieldStats) {
  return `Typical ${stats.min}–${stats.max} • avg ${stats.avg}`;
}

export interface RatingInfo {
  rating: number;
  percentile: number;
  avg: number;
  min: number;
  max: number;
}

/** Given the rating of one item and the ratings of the whole pool, derive
 *  percentile / min / max / avg to drive a Progress bar. */
export function rateValueAgainst(rating: number, poolRatings: number[]): RatingInfo {
  if (poolRatings.length === 0) {
    return { rating, percentile: 50, avg: rating, min: rating, max: rating };
  }
  const sorted = [...poolRatings].sort((a, b) => a - b);
  const below = sorted.filter((r) => r < rating).length;
  const percentile = Math.round((below / sorted.length) * 100);
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { rating, percentile, avg, min: sorted[0], max: sorted[sorted.length - 1] };
}
