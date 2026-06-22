/**
 * Spec reference parser
 *
 * Parses spec references in various formats:
 * - Local: my-spec, my-spec@1.0.0
 * - Public: alice/my-spec, alice/my-spec@1.0.0
 */

/**
 * Parsed spec reference
 */
export interface ParsedSpecRef {
  /** Username (only for public specs) */
  username?: string;
  /** Spec name */
  name: string;
  /** Version (optional) */
  version?: string;
  /** Whether this is a public spec (has username) */
  isPublic: boolean;
}

/**
 * Validation patterns
 */
const PATTERNS = {
  // Username: lowercase alphanumeric + hyphens, 1-39 chars (GitHub username rules)
  username: /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/,
  // Spec name: lowercase alphanumeric + hyphens, 1-100 chars
  name: /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/,
  // Strict semver: no leading zeros in any component
  version: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
} as const;

/**
 * Parse a spec reference string
 *
 * Supports the following formats:
 * - Local: `my-spec` (latest version)
 * - Local: `my-spec@1.0.0` (specific version)
 * - Public: `alice/my-spec` (latest version)
 * - Public: `alice/my-spec@1.0.0` (specific version)
 *
 * @param specRef - Spec reference string
 * @returns Parsed spec reference object
 * @throws Error if the format is invalid
 *
 * @example
 * ```typescript
 * parseSpecRef('my-spec')
 * // => { name: 'my-spec', isPublic: false }
 *
 * parseSpecRef('my-spec@1.0.0')
 * // => { name: 'my-spec', version: '1.0.0', isPublic: false }
 *
 * parseSpecRef('alice/my-spec')
 * // => { username: 'alice', name: 'my-spec', isPublic: true }
 *
 * parseSpecRef('alice/my-spec@1.0.0')
 * // => { username: 'alice', name: 'my-spec', version: '1.0.0', isPublic: true }
 * ```
 */
export function parseSpecRef(specRef: string): ParsedSpecRef {
  // Validate input
  if (!specRef || typeof specRef !== 'string') {
    throw new Error('Spec reference must be a non-empty string');
  }

  // Trim whitespace
  const trimmed = specRef.trim();

  if (trimmed.length === 0) {
    throw new Error('Spec reference must be a non-empty string');
  }

  // Check for public format (contains /)
  if (trimmed.includes('/')) {
    return parsePublicSpecRef(trimmed);
  }

  // Local format
  return parseLocalSpecRef(trimmed);
}

/**
 * Parse a local spec reference (no username)
 *
 * Formats:
 * - my-spec
 * - my-spec@1.0.0
 */
function parseLocalSpecRef(specRef: string): ParsedSpecRef {
  // Check for version
  const atIndex = specRef.indexOf('@');

  if (atIndex === -1) {
    // No version: my-spec
    const name = specRef;

    if (!PATTERNS.name.test(name)) {
      throw new Error(
        `Invalid spec name: ${name}. Must be lowercase alphanumeric with hyphens, 1-100 characters`,
      );
    }

    return {
      name,
      isPublic: false,
    };
  }

  // Has version: my-spec@1.0.0
  const name = specRef.slice(0, atIndex);
  const version = specRef.slice(atIndex + 1);

  if (!PATTERNS.name.test(name)) {
    throw new Error(
      `Invalid spec name: ${name}. Must be lowercase alphanumeric with hyphens, 1-100 characters`,
    );
  }

  if (!PATTERNS.version.test(version)) {
    throw new Error(
      `Invalid version: ${version}. Must be valid semver (e.g., 1.0.0) with no leading zeros`,
    );
  }

  return {
    name,
    version,
    isPublic: false,
  };
}

/**
 * Parse a public spec reference (has username)
 *
 * Formats:
 * - alice/my-spec
 * - alice/my-spec@1.0.0
 */
function parsePublicSpecRef(specRef: string): ParsedSpecRef {
  // Split on first /
  const slashIndex = specRef.indexOf('/');

  if (slashIndex === -1 || slashIndex === 0 || slashIndex === specRef.length - 1) {
    throw new Error(
      `Invalid public spec reference: ${specRef}. Must be in format username/spec or username/spec@version`,
    );
  }

  const username = specRef.slice(0, slashIndex);
  const nameAndVersion = specRef.slice(slashIndex + 1);

  // Validate username
  if (!PATTERNS.username.test(username)) {
    throw new Error(
      `Invalid username: ${username}. Must be lowercase alphanumeric with hyphens, 1-39 characters`,
    );
  }

  // Check for version in nameAndVersion
  const atIndex = nameAndVersion.indexOf('@');

  if (atIndex === -1) {
    // No version: alice/my-spec
    const name = nameAndVersion;

    if (!PATTERNS.name.test(name)) {
      throw new Error(
        `Invalid spec name: ${name}. Must be lowercase alphanumeric with hyphens, 1-100 characters`,
      );
    }

    return {
      username,
      name,
      isPublic: true,
    };
  }

  // Has version: alice/my-spec@1.0.0
  const name = nameAndVersion.slice(0, atIndex);
  const version = nameAndVersion.slice(atIndex + 1);

  if (!PATTERNS.name.test(name)) {
    throw new Error(
      `Invalid spec name: ${name}. Must be lowercase alphanumeric with hyphens, 1-100 characters`,
    );
  }

  if (!PATTERNS.version.test(version)) {
    throw new Error(
      `Invalid version: ${version}. Must be valid semver (e.g., 1.0.0) with no leading zeros`,
    );
  }

  return {
    username,
    name,
    version,
    isPublic: true,
  };
}

/**
 * Format a parsed spec reference back to a string
 *
 * @param parsed - Parsed spec reference
 * @returns Formatted spec reference string
 *
 * @example
 * ```typescript
 * formatSpecRef({ name: 'my-spec', isPublic: false })
 * // => 'my-spec'
 *
 * formatSpecRef({ username: 'alice', name: 'my-spec', version: '1.0.0', isPublic: true })
 * // => 'alice/my-spec@1.0.0'
 * ```
 */
export function formatSpecRef(parsed: ParsedSpecRef): string {
  const parts: string[] = [];

  if (parsed.username) {
    parts.push(`${parsed.username}/`);
  }

  parts.push(parsed.name);

  if (parsed.version) {
    parts.push(`@${parsed.version}`);
  }

  return parts.join('');
}
