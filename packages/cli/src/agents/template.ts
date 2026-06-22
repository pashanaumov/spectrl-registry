/**
 * Template module for AGENTS.md file generation
 * Provides constants and functions for creating and managing AGENTS.md content
 */

/**
 * Marker used to identify Spectrl-generated content in AGENTS.md
 */
export const SPECTRL_MARKER = '<!-- Added by Spectrl -->';

/**
 * Complete AGENTS.md template content
 * This is the content that appears after the marker
 */
export const AGENTS_TEMPLATE = `# AI Assistant Instructions for Spectrl

## What is Spectrl?

Spectrl is a knowledge registry storing two types of authoritative content:

- **Specs** — Static context documents (PRDs, TDDs, ADRs, architecture decisions). Read before answering questions or generating code.
- **Powers** — Behavioral instructions (workflows, patterns, checklists). Follow when performing tasks.

Both are versioned, installable, and agent-readable.

## Core Principles

1. **Catalog first** — Always start with \`.spectrl/catalog.md\`
2. **Lazy-load** — Only read content relevant to the current task
3. **Never assume** — When ambiguous, ask
4. **Human decides** — You assist; the user has final say
5. **Be thorough but efficient** — Read what's needed, not everything

## Discovering Installed Content

Read \`.spectrl/catalog.md\` first — it lists all installed specs and powers with names, versions, types, descriptions, and "when to use" guidance:

\`\`\`
| Name        | Version | Type  | Description            | When to Use                      |
| ----------- | ------- | ----- | ---------------------- | -------------------------------- |
| api-design  | 1.0.0   | spec  | API design conventions | Consult when designing REST APIs |
| code-review | 2.0.0   | power | Code review checklist  | Follow during code reviews       |
\`\`\`

Load relevant items from \`.spectrl/specs/{name}@{version}/\`. If \`catalog.md\` is missing, fall back to \`.spectrl/spectrl-index.json\`.

## Using Specs and Powers

**Before acting:** Read the catalog → identify relevant items → load them → apply specs as context, follow powers as instructions.

**Specs (context):** Read before answering questions about APIs, security, architecture, testing, code style, or project workflows. Cite as \`[spec:name@version]\`. Prefer spec guidance over general best practices.

**Powers (instructions):** Follow step-by-step when performing code reviews, refactoring, deployments, testing, etc. Cite as \`[power:name@version]\`.

**Reading files:** Check for \`README.md\`, \`INDEX.md\`, or \`index.md\` as entry points first. For items with 20+ files and a narrow question, scan filenames before reading everything. Don't re-read items already loaded in the conversation.

**Dependencies:** Follow spec/power references up to 5 levels deep. If the chain exceeds 5 levels or loops: state what you've followed and ask whether to continue.

**No relevant content found:** Use general best practices, note that no installed content applied, and suggest creating a spec or power if it's a recurring need.

## When to Infer vs. Ask

**Infer when:** Content explicitly covers the topic with clear examples and no judgment calls are needed.

**Ask when:** Language is ambiguous ("should", "consider", "typically"), multiple valid interpretations exist, stakes are high (security, data integrity, public APIs), or you're extrapolating rather than applying explicit rules.

**Always ask when:** Content is silent on the specific point, applying it could have significant side effects, or you need assumptions to bridge gaps.

Once a clarification is made, remember it — don't ask the same question twice.

## Conflict Resolution

| Situation | Action |
|---|---|
| Multiple items cover same topic | Ask which takes precedence |
| Version unspecified | Use catalog version; ask if uncertain |
| Partial coverage | Apply what exists; ask before filling gaps with general knowledge |
| Outdated content | Follow as written; flag the concern |
| Self-contradictory content | Cite both sections and ask; never choose silently |
| User request conflicts with content | State the requirement, ask whether to follow installed content or user's approach |

## Error Handling

- **\`catalog.md\` missing** — Fall back to \`spectrl-index.json\`; inform the user to run \`spectrl install\`
- **Unreadable files** — Report the issue and ask whether to proceed with available info
- **Errors in content** — Flag them; follow as written unless instructed otherwise; never silently "correct"

## Key Reminders

- **Catalog first** · **Lazy-load** · **Specs = context** · **Powers = instructions**
- **Never guess** · **Human decides** · **Cite sources** · **Remember context** · **Flag but follow**
`;

/**
 * Get the complete AGENTS.md content for a new file
 * Includes marker as first line followed by template
 */
export function getNewFileContent(): string {
  return `${SPECTRL_MARKER}\n${AGENTS_TEMPLATE}`;
}

/**
 * Get the content to append to an existing AGENTS.md
 * Includes separator, marker, and template
 */
export function getAppendContent(): string {
  return `\n\n---\n\n${SPECTRL_MARKER}\n${AGENTS_TEMPLATE}`;
}
