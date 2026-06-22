import { describe, it, expect } from 'vitest';
import {
  SPECTRL_MARKER,
  AGENTS_TEMPLATE,
  getNewFileContent,
  getAppendContent,
} from './template.js';

describe('Template Module', () => {
  describe('SPECTRL_MARKER', () => {
    it('should be correctly defined as HTML comment', () => {
      expect(SPECTRL_MARKER).toBe('<!-- Added by Spectrl -->');
    });

    it('should be a non-empty string', () => {
      expect(SPECTRL_MARKER).toBeTruthy();
      expect(typeof SPECTRL_MARKER).toBe('string');
      expect(SPECTRL_MARKER.length).toBeGreaterThan(0);
    });
  });

  describe('AGENTS_TEMPLATE', () => {
    it('should be a non-empty string', () => {
      expect(AGENTS_TEMPLATE).toBeTruthy();
      expect(typeof AGENTS_TEMPLATE).toBe('string');
      expect(AGENTS_TEMPLATE.length).toBeGreaterThan(0);
    });

    it('should contain key sections', () => {
      expect(AGENTS_TEMPLATE).toContain('# AI Assistant Instructions for Spectrl');
      expect(AGENTS_TEMPLATE).toContain('## What is Spectrl?');
      expect(AGENTS_TEMPLATE).toContain('## Core Principles');
      expect(AGENTS_TEMPLATE).toContain('## Discovering Installed Content');
      expect(AGENTS_TEMPLATE).toContain('## Using Specs and Powers');
    });

    // Requirement 4.1 — catalog.md as primary discovery mechanism
    it('should reference .spectrl/catalog.md as primary discovery mechanism', () => {
      expect(AGENTS_TEMPLATE).toContain('.spectrl/catalog.md');
    });

    it('should instruct agents to read catalog.md first', () => {
      expect(AGENTS_TEMPLATE).toContain('Catalog first');
      expect(AGENTS_TEMPLATE).toContain('catalog.md');
    });

    // Requirement 4.2 — explain specs as static context documents
    it('should explain that specs are static context documents', () => {
      expect(AGENTS_TEMPLATE).toContain('Static context documents');
      expect(AGENTS_TEMPLATE).toContain('Specs (context)');
    });

    // Requirement 4.3 — explain powers as behavioral instructions
    it('should explain that powers are behavioral instructions', () => {
      expect(AGENTS_TEMPLATE).toContain('Behavioral instructions');
      expect(AGENTS_TEMPLATE).toContain('Powers (instructions)');
    });

    // Requirement 4.4 — instruct catalog-first, then lazy-load
    it('should instruct catalog-first discovery then lazy-load relevant content', () => {
      expect(AGENTS_TEMPLATE).toContain('Catalog first');
      expect(AGENTS_TEMPLATE).toContain('Lazy-load');
    });

    it('should not contain old "scan .spectrl/specs/ directory" instructions', () => {
      expect(AGENTS_TEMPLATE).not.toContain('Check `.spectrl/specs/` directory for all installed');
      expect(AGENTS_TEMPLATE).not.toContain('## Primary Source of Truth');
      expect(AGENTS_TEMPLATE).not.toContain('## Installed Specs');
    });

    it('should distinguish between spec and power citation formats', () => {
      expect(AGENTS_TEMPLATE).toContain('[spec:name@version]');
      expect(AGENTS_TEMPLATE).toContain('[power:name@version]');
    });

    it('should mention fallback to spectrl-index.json when catalog is missing', () => {
      expect(AGENTS_TEMPLATE).toContain('spectrl-index.json');
    });
  });

  describe('getNewFileContent', () => {
    it('should return marker as first line followed by template', () => {
      const content = getNewFileContent();

      // Should start with marker
      expect(content.startsWith(SPECTRL_MARKER)).toBe(true);

      // Should have newline after marker
      expect(content.startsWith(`${SPECTRL_MARKER}\n`)).toBe(true);

      // Should contain the template after marker
      expect(content).toBe(`${SPECTRL_MARKER}\n${AGENTS_TEMPLATE}`);
    });

    it('should return a non-empty string', () => {
      const content = getNewFileContent();

      expect(content).toBeTruthy();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have marker on the first line', () => {
      const content = getNewFileContent();
      const firstLine = content.split('\n')[0];

      expect(firstLine).toBe(SPECTRL_MARKER);
    });

    it('should contain both marker and template', () => {
      const content = getNewFileContent();

      expect(content).toContain(SPECTRL_MARKER);
      expect(content).toContain(AGENTS_TEMPLATE);
    });
  });

  describe('getAppendContent', () => {
    it('should return separator, marker, and template', () => {
      const content = getAppendContent();

      // Should start with double newline and separator
      expect(content.startsWith('\n\n---\n\n')).toBe(true);

      // Should contain marker after separator
      expect(content).toContain(`---\n\n${SPECTRL_MARKER}\n`);

      // Should match expected format exactly
      expect(content).toBe(`\n\n---\n\n${SPECTRL_MARKER}\n${AGENTS_TEMPLATE}`);
    });

    it('should return a non-empty string', () => {
      const content = getAppendContent();

      expect(content).toBeTruthy();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should start with newlines for separation', () => {
      const content = getAppendContent();

      expect(content.startsWith('\n\n')).toBe(true);
    });

    it('should contain separator line', () => {
      const content = getAppendContent();

      expect(content).toContain('---');
    });

    it('should contain both marker and template', () => {
      const content = getAppendContent();

      expect(content).toContain(SPECTRL_MARKER);
      expect(content).toContain(AGENTS_TEMPLATE);
    });

    it('should have proper spacing between separator and marker', () => {
      const content = getAppendContent();

      // Should have double newline before separator, and double newline after
      expect(content).toContain('\n\n---\n\n');
    });
  });

  describe('Content Consistency', () => {
    it('should use the same marker in both functions', () => {
      const newContent = getNewFileContent();
      const appendContent = getAppendContent();

      expect(newContent).toContain(SPECTRL_MARKER);
      expect(appendContent).toContain(SPECTRL_MARKER);
    });

    it('should use the same template in both functions', () => {
      const newContent = getNewFileContent();
      const appendContent = getAppendContent();

      expect(newContent).toContain(AGENTS_TEMPLATE);
      expect(appendContent).toContain(AGENTS_TEMPLATE);
    });

    it('should have different prefixes for new vs append', () => {
      const newContent = getNewFileContent();
      const appendContent = getAppendContent();

      // New file starts with marker directly
      expect(newContent.startsWith(SPECTRL_MARKER)).toBe(true);

      // Append starts with separator
      expect(appendContent.startsWith('\n\n---')).toBe(true);
    });
  });
});
