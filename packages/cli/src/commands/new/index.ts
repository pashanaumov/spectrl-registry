import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import ora from 'ora';
import { fileExists } from '../../utils.js';
import { formatHighlight, ExitCode, CLIError } from '../../errors.js';

/**
 * JSONC manifest template for a spec
 */
function buildSpecManifest(name: string, version: string): string {
  return `{
  "name": "${name}",
  "version": "${version}",
  "type": "spec",
  // Required for publishing. Describe what this spec covers.
  // "description": "",
  "files": ["index.md"],
  "deps": {}
  // Recommended: help agents discover and use this spec.
  // "agent": {
  //   "purpose": "Explain when agents should consult this spec",
  //   "tags": ["relevant", "keywords"]
  // }
}
`;
}

/**
 * JSONC manifest template for a power
 */
function buildPowerManifest(name: string, version: string): string {
  return `{
  "name": "${name}",
  "version": "${version}",
  "type": "power",
  // Required for publishing. Describe what this power does.
  // "description": "",
  "files": ["index.md"],
  "deps": {}
  // Recommended: help agents discover and use this power.
  // "agent": {
  //   "purpose": "Explain when agents should follow these instructions",
  //   "tags": ["relevant", "keywords"]
  // }
}
`;
}

/**
 * index.md template for a spec — includes guidance and a quality checklist
 */
const SPEC_INDEX_TEMPLATE = `# [Spec Name]

<!-- What is this spec about? Write 1-2 sentences an agent can use to decide whether to load it. -->

## Overview

Describe the context this spec provides. Good specs are:

- **Focused** — cover one topic or decision area, not everything
- **Stable** — capture decisions already made, not open questions
- **Actionable** — give an agent enough context to act correctly without guessing
- **Scoped** — link to related specs rather than duplicating content

## Content

Add your spec content here.

## Quality Checklist

Before publishing, verify:

- [ ] The overview clearly states what this spec covers
- [ ] An agent reading only this file would have enough context to act
- [ ] Decisions are stated as facts, not as options to consider
- [ ] Ambiguous terms are defined or linked
- [ ] The \`description\` field in spectrl.jsonc is filled in
- [ ] The \`agent.purpose\` field explains *when* to consult this spec
`;

/**
 * index.md template for a power — includes guidance and a quality checklist
 */
const POWER_INDEX_TEMPLATE = `# [Power Name]

<!-- What does this power do? Write 1-2 sentences an agent can use to decide whether to follow it. -->

## When to Use

Describe the situations where an agent should follow these instructions. Good powers are:

- **Triggered** — clearly state the condition that activates them (e.g. "when reviewing a PR", "when writing a migration")
- **Prescriptive** — tell the agent exactly what to do, not just what to consider
- **Bounded** — cover one workflow or pattern, not a grab-bag of rules
- **Verifiable** — each step should have a clear done state

## Instructions

1. Step one
2. Step two
3. Step three

## Quality Checklist

Before publishing, verify:

- [ ] The "When to Use" section makes the trigger condition unambiguous
- [ ] Every instruction is an action, not a suggestion
- [ ] The steps are in the order an agent should follow them
- [ ] Edge cases or exceptions are called out explicitly
- [ ] The \`description\` field in spectrl.jsonc is filled in
- [ ] The \`agent.purpose\` field explains *when* to activate this power
`;

/**
 * Create a new spec or power directory with a JSONC manifest and index.md
 *
 * @param name - Name of the spec/power (lowercase alphanumeric with hyphens)
 * @param cwd - Current working directory
 * @param type - Content type: 'spec' or 'power'
 * @param version - Initial version (defaults to "0.1.0")
 * @param description - Optional description (unused at scaffold time; prompted via JSONC comment)
 */
export async function newContent(
  name: string,
  cwd: string,
  type: 'spec' | 'power' = 'spec',
  version = '0.1.0',
  description?: string,
): Promise<void> {
  const spinner = ora({ text: `Creating new ${type}`, spinner: 'line' }).start();

  try {
    // Validate name format (lowercase alphanumeric with hyphens)
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new CLIError(
        'Name must be lowercase alphanumeric with hyphens',
        ExitCode.VALIDATION_ERROR,
      );
    }

    // Check if directory already exists
    const contentDir = join(cwd, name);
    if (await fileExists(contentDir)) {
      throw new CLIError(`Directory already exists: ${name}`, ExitCode.VALIDATION_ERROR);
    }

    // Create directory
    spinner.text = `Creating directory ${name}`;
    await mkdir(contentDir, { recursive: true });

    // Write spectrl.jsonc manifest with inline comments
    const manifestContent =
      type === 'power' ? buildPowerManifest(name, version) : buildSpecManifest(name, version);
    const manifestPath = join(contentDir, 'spectrl.jsonc');
    await writeFile(manifestPath, manifestContent, 'utf-8');

    // Write index.md with appropriate template
    const indexContent = type === 'power' ? POWER_INDEX_TEMPLATE : SPEC_INDEX_TEMPLATE;
    const indexPath = join(contentDir, 'index.md');
    await writeFile(indexPath, indexContent, 'utf-8');

    spinner.succeed(
      `Created new ${type} ${formatHighlight(name)} at ${formatHighlight(`${name}/spectrl.jsonc`)}`,
    );
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * @deprecated Use newContent instead
 */
export async function newSpec(
  name: string,
  cwd: string,
  version = '0.1.0',
  description?: string,
): Promise<void> {
  return newContent(name, cwd, 'spec', version, description);
}
