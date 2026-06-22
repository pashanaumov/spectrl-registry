import { parse as jsoncParse } from 'jsonc-parse';

/**
 * Parses a JSONC string (JSON with Comments) into an unknown value.
 * Strips single-line comments (//), multi-line comments (/* *\/), and trailing commas.
 * @throws Error with descriptive message on invalid content
 */
export function parseJsoncString(content: string): unknown {
  try {
    return jsoncParse(content);
  } catch (err) {
    throw new Error(`JSONC parse error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
