export type LevelDisplayMode = 'letters' | 'exponent';

function cleanLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.floor(level));
}

function trimMantissa(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function suffixForGroup(index: number): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let n = Math.max(0, index);
  let suffix = '';

  do {
    suffix = letters[n % 26] + suffix;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);

  return suffix.length === 1 ? `a${suffix}` : suffix;
}

export function formatLevelValue(level: number, mode: LevelDisplayMode = 'letters'): string {
  const value = cleanLevel(level);
  if (value < 1000) return value.toLocaleString();

  if (mode === 'exponent') {
    const exponent = Math.floor(Math.log10(value));
    const mantissa = value / Math.pow(10, exponent);
    return `${trimMantissa(mantissa)}^${exponent}`;
  }

  const group = Math.floor(Math.log(value) / Math.log(1000));
  const scaled = value / Math.pow(1000, group);
  return `${trimMantissa(scaled)} ${suffixForGroup(group - 1)}`;
}

export function formatLevel(level: number, mode: LevelDisplayMode = 'letters'): string {
  return `Lv ${formatLevelValue(level, mode)}`;
}
