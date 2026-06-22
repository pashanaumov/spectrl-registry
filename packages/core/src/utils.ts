import semver from 'semver';

/**
 * Compare two semantic version strings using the semver package
 *
 * @param a - First version string (e.g., "1.2.3")
 * @param b - Second version string (e.g., "2.0.0")
 * @returns Positive if a > b, negative if a < b, zero if equal
 *
 * @example
 * ```typescript
 * compareSemver("2.0.0", "1.9.9") // returns 1
 * compareSemver("1.0.0", "2.0.0") // returns -1
 * compareSemver("1.2.3", "1.2.3") // returns 0
 * ```
 */
export function compareSemver(a: string, b: string): number {
  return semver.compare(a, b);
}
