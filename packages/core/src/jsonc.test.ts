import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseJsoncString } from './jsonc.js';

/**
 * Recursively checks whether a value contains any problematic keys or values
 * that don't survive a JSON round-trip faithfully:
 *   - -0: JSON.stringify(-0) === "0", so +0 comes back
 *   - "__proto__" key: JSON.parse doesn't set it as an own property
 *   - "constructor" / "prototype" keys: prototype-pollution risk, same issue
 */
function hasRoundTripIssue(v: unknown): boolean {
  if (Object.is(v, -0)) return true;
  if (Array.isArray(v)) return v.some(hasRoundTripIssue);
  if (v !== null && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return true;
      if (hasRoundTripIssue(val)) return true;
    }
  }
  return false;
}

// Arbitrary for JSON-serializable values that survive a JSON round-trip faithfully.
const jsonValueArb: fc.Arbitrary<unknown> = fc.jsonValue().filter((v) => !hasRoundTripIssue(v));

describe('parseJsoncString', () => {
  describe('Property 8: JSONC parsing equivalence', () => {
    // Feature: specs-and-powers, Property 8: JSONC parsing equivalence
    // Validates: Requirements 8.3, 8.4, 8.5
    it('should parse valid JSON with injected single-line comments to the same value', () => {
      fc.assert(
        fc.property(jsonValueArb, (value) => {
          const json = JSON.stringify(value);
          // Inject a single-line comment before the value
          const withComment = `// this is a comment\n${json}`;
          const result = parseJsoncString(withComment);
          expect(result).toEqual(value);
        }),
        { numRuns: 100 },
      );
    });

    it('should parse valid JSON with injected multi-line comments to the same value', () => {
      fc.assert(
        fc.property(jsonValueArb, (value) => {
          const json = JSON.stringify(value);
          const withComment = `/* multi\nline\ncomment */\n${json}`;
          const result = parseJsoncString(withComment);
          expect(result).toEqual(value);
        }),
        { numRuns: 100 },
      );
    });

    it('should parse valid JSON objects with trailing commas', () => {
      // Trailing commas only valid in objects/arrays, so we use object values
      // Filter out __proto__ and other prototype-polluting keys
      const safeKey = fc
        .string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 10 })
        .filter(
          (s) =>
            /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s) &&
            s !== '__proto__' &&
            s !== 'constructor' &&
            s !== 'prototype',
        );
      fc.assert(
        fc.property(
          fc.dictionary(safeKey, fc.oneof(fc.string(), fc.integer(), fc.boolean())),
          (obj) => {
            if (Object.keys(obj).length === 0) return true;
            // Build JSON with trailing comma in object
            const entries = Object.entries(obj)
              .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
              .join(', ');
            const withTrailingComma = `{ ${entries}, }`;
            const result = parseJsoncString(withTrailingComma);
            expect(result).toEqual(obj);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Unit tests', () => {
    it('should parse plain JSON', () => {
      expect(parseJsoncString('{"a": 1}')).toEqual({ a: 1 });
    });

    it('should strip single-line comments', () => {
      const input = `{
        // this is a comment
        "name": "test"
      }`;
      expect(parseJsoncString(input)).toEqual({ name: 'test' });
    });

    it('should strip multi-line comments', () => {
      const input = `{
        /* multi
           line */
        "name": "test"
      }`;
      expect(parseJsoncString(input)).toEqual({ name: 'test' });
    });

    it('should handle trailing commas in objects', () => {
      expect(parseJsoncString('{"a": 1,}')).toEqual({ a: 1 });
    });

    it('should handle trailing commas in arrays', () => {
      expect(parseJsoncString('[1, 2, 3,]')).toEqual([1, 2, 3]);
    });

    it('should throw on invalid content', () => {
      expect(() => parseJsoncString('{ invalid json }')).toThrow('JSONC parse error');
    });
  });
});
