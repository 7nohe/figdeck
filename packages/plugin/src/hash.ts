/**
 * djb2 hash algorithm initial value.
 * This is the standard starting value for djb2, chosen by Daniel J. Bernstein.
 */
const DJB2_INIT = 5381;

/**
 * Compute a djb2 hash of a string.
 * Fast and produces good distribution for cache keys.
 */
export function djb2Hash(str: string): string {
  let hash = DJB2_INIT;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Compute a hash for large strings by sampling.
 * Takes first and last portions plus length to avoid hashing huge strings.
 */
export function djb2HashSampled(
  data: string,
  sampleSize: number = 1000,
): string {
  const threshold = sampleSize * 2;
  const sample =
    data.length > threshold
      ? data.slice(0, sampleSize) + data.slice(-sampleSize) + data.length
      : data;
  return djb2Hash(sample);
}
