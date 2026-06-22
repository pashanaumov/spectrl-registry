#!/usr/bin/env bun

/**
 * Dev data seeder for LocalStack.
 *
 * Generates a realistic mix of specs and powers with:
 * - Curated, meaningful names and descriptions
 * - Single-file and multi-file items
 * - Items with 1, 2, or 3 versions
 * - Realistic markdown content via @faker-js/faker
 * - Proper agent metadata (purpose + tags)
 *
 * Usage:
 *   bun infra/scripts/seed-dev-data.ts [options]
 *
 * Options:
 *   --count <n>       Number of items to seed (default: all curated items)
 *   --no-clean        Skip cleaning existing data before seeding
 *   --help            Show usage info
 *
 * Prerequisites:
 *   - LocalStack running with terraform deployed
 *   - awslocal CLI available (for terraform output lookup)
 */

import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { faker } from '@faker-js/faker';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
// infra/scripts/ → infra/environments/dev
const TF_DIR = resolve(import.meta.dirname ?? '.', '../environments/dev');

const s3 = new S3Client({
  endpoint: LOCALSTACK_ENDPOINT,
  region: 'eu-north-1',
  forcePathStyle: true,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

const dynamo = new DynamoDBClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: 'eu-north-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentType = 'spec' | 'power';

interface SeedItem {
  name: string;
  type: ContentType;
  description: string;
  purpose: string;
  tags: string[];
  extraFiles: string[]; // additional filenames beyond index.md
  versions: number; // how many versions to create (1-3)
}

// ---------------------------------------------------------------------------
// Curated catalog of items to seed
// ---------------------------------------------------------------------------

// Generated at seed time — faker.seed(42) makes these deterministic
let USERNAMES: string[] = [];

const SEED_ITEMS: SeedItem[] = [
  // ── Specs ──────────────────────────────────────────────────────────────

  // API
  {
    name: 'rest-api-standard',
    type: 'spec',
    description: 'REST API design conventions for consistent, predictable endpoints',
    purpose: 'Consult when designing or reviewing REST API endpoints',
    tags: ['api', 'rest', 'design', 'conventions'],
    extraFiles: ['error-codes.md', 'pagination.md'],
    versions: 3,
  },
  {
    name: 'graphql-schema-guide',
    type: 'spec',
    description: 'Guidelines for designing GraphQL schemas with federation support',
    purpose: 'Reference when building or extending GraphQL schemas',
    tags: ['graphql', 'schema', 'api', 'federation'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'api-versioning-policy',
    type: 'spec',
    description: 'Rules for versioning public APIs without breaking clients',
    purpose: 'Check before making breaking changes to any public API',
    tags: ['api', 'versioning', 'breaking-changes'],
    extraFiles: ['migration-checklist.md'],
    versions: 1,
  },
  {
    name: 'webhook-design-spec',
    type: 'spec',
    description: 'Webhook payload structure, retry policies, and signature verification',
    purpose: 'Reference when implementing webhook producers or consumers',
    tags: ['api', 'webhooks', 'events', 'integration'],
    extraFiles: ['payload-examples.md'],
    versions: 2,
  },

  // Architecture
  {
    name: 'microservices-patterns',
    type: 'spec',
    description: 'Common microservices patterns including circuit breakers and sagas',
    purpose: 'Consult when designing service boundaries or inter-service communication',
    tags: ['architecture', 'microservices', 'patterns', 'distributed'],
    extraFiles: ['circuit-breaker.md', 'saga-pattern.md', 'service-mesh.md'],
    versions: 3,
  },
  {
    name: 'event-driven-arch',
    type: 'spec',
    description: 'Event-driven architecture with message brokers and event sourcing',
    purpose: 'Reference when implementing async workflows or event stores',
    tags: ['architecture', 'events', 'messaging', 'async'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'monorepo-structure',
    type: 'spec',
    description: 'Monorepo layout conventions for TypeScript projects',
    purpose: 'Consult when setting up or restructuring a monorepo',
    tags: ['architecture', 'monorepo', 'typescript', 'structure'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'cqrs-event-sourcing',
    type: 'spec',
    description: 'CQRS and event sourcing patterns for complex domain models',
    purpose: 'Reference when separating read and write models',
    tags: ['architecture', 'cqrs', 'event-sourcing', 'ddd'],
    extraFiles: ['projections.md', 'snapshots.md'],
    versions: 2,
  },

  // Database
  {
    name: 'postgres-conventions',
    type: 'spec',
    description: 'PostgreSQL naming, indexing, and migration conventions',
    purpose: 'Reference when writing migrations or designing schemas',
    tags: ['database', 'postgres', 'sql', 'migrations'],
    extraFiles: ['naming-rules.md', 'index-strategy.md'],
    versions: 3,
  },
  {
    name: 'dynamodb-patterns',
    type: 'spec',
    description: 'DynamoDB single-table design patterns and access patterns',
    purpose: 'Consult when modeling data for DynamoDB',
    tags: ['database', 'dynamodb', 'nosql', 'aws'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'redis-caching-spec',
    type: 'spec',
    description: 'Redis caching strategies, TTL policies, and invalidation patterns',
    purpose: 'Reference when adding or modifying cache layers',
    tags: ['database', 'redis', 'caching', 'performance'],
    extraFiles: [],
    versions: 2,
  },

  // Security
  {
    name: 'auth-patterns',
    type: 'spec',
    description: 'Authentication and authorization patterns for web applications',
    purpose: 'Reference when implementing auth flows',
    tags: ['security', 'auth', 'oauth', 'jwt'],
    extraFiles: ['oauth-flows.md', 'jwt-best-practices.md', 'rbac.md'],
    versions: 3,
  },
  {
    name: 'secrets-management',
    type: 'spec',
    description: 'How to handle secrets, API keys, and credentials safely',
    purpose: 'Consult before storing or transmitting any secret',
    tags: ['security', 'secrets', 'credentials', 'encryption'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'input-validation-spec',
    type: 'spec',
    description: 'Input validation and sanitization rules for all user-facing endpoints',
    purpose: 'Reference when handling user input in any service',
    tags: ['security', 'validation', 'sanitization', 'xss'],
    extraFiles: [],
    versions: 1,
  },

  // Testing
  {
    name: 'testing-philosophy',
    type: 'spec',
    description: 'Testing pyramid, what to test, and when to skip tests',
    purpose: 'Consult when deciding test strategy for a new feature',
    tags: ['testing', 'strategy', 'quality'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'contract-testing-guide',
    type: 'spec',
    description: 'Consumer-driven contract testing with Pact',
    purpose: 'Reference when setting up contract tests between services',
    tags: ['testing', 'contracts', 'pact', 'integration'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'property-based-testing',
    type: 'spec',
    description: 'Introduction to property-based testing with fast-check',
    purpose: 'Reference when writing property tests for pure functions',
    tags: ['testing', 'property-based', 'fast-check'],
    extraFiles: [],
    versions: 1,
  },

  // Frontend
  {
    name: 'react-component-spec',
    type: 'spec',
    description: 'React component conventions including naming, props, and composition',
    purpose: 'Consult when building or reviewing React components',
    tags: ['react', 'components', 'frontend', 'conventions'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'accessibility-standard',
    type: 'spec',
    description: 'WCAG 2.1 AA compliance requirements for all UI components',
    purpose: 'Reference during UI development and review',
    tags: ['accessibility', 'wcag', 'a11y', 'frontend'],
    extraFiles: ['checklist.md', 'aria-patterns.md'],
    versions: 2,
  },
  {
    name: 'design-tokens-spec',
    type: 'spec',
    description: 'Design token naming and structure for consistent theming',
    purpose: 'Consult when adding or modifying design tokens',
    tags: ['design', 'tokens', 'theming', 'css'],
    extraFiles: [],
    versions: 1,
  },

  // DevOps
  {
    name: 'ci-cd-pipeline-spec',
    type: 'spec',
    description: 'CI/CD pipeline stages, gates, and deployment strategies',
    purpose: 'Reference when configuring or modifying pipelines',
    tags: ['devops', 'ci-cd', 'deployment', 'automation'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'docker-conventions',
    type: 'spec',
    description: 'Dockerfile best practices and image tagging conventions',
    purpose: 'Consult when writing or reviewing Dockerfiles',
    tags: ['devops', 'docker', 'containers', 'images'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'terraform-patterns',
    type: 'spec',
    description: 'Terraform module structure and state management conventions',
    purpose: 'Reference when writing infrastructure as code',
    tags: ['devops', 'terraform', 'iac', 'infrastructure'],
    extraFiles: ['module-structure.md', 'state-management.md'],
    versions: 3,
  },
  {
    name: 'observability-spec',
    type: 'spec',
    description: 'Logging, metrics, and tracing standards for production services',
    purpose: 'Reference when instrumenting a service for observability',
    tags: ['devops', 'observability', 'logging', 'metrics'],
    extraFiles: ['structured-logging.md'],
    versions: 2,
  },

  // Documentation
  {
    name: 'adr-template',
    type: 'spec',
    description: 'Architecture Decision Record template and process',
    purpose: 'Use when documenting an architecture decision',
    tags: ['documentation', 'adr', 'decisions', 'architecture'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'runbook-template',
    type: 'spec',
    description: 'Incident runbook template for production services',
    purpose: 'Use when creating runbooks for new services',
    tags: ['documentation', 'runbook', 'incidents', 'operations'],
    extraFiles: [],
    versions: 1,
  },

  // Agent / AI
  {
    name: 'agent-response-style',
    type: 'spec',
    description: 'Preferred tone, format, and structure for AI agent responses',
    purpose: 'Agents should read this to calibrate their response style',
    tags: ['agent', 'style', 'tone', 'formatting'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'prompt-engineering-guide',
    type: 'spec',
    description: 'Patterns for writing effective prompts and system instructions',
    purpose: 'Reference when crafting prompts or agent configurations',
    tags: ['agent', 'prompts', 'llm', 'patterns'],
    extraFiles: [],
    versions: 1,
  },

  // ── Powers ─────────────────────────────────────────────────────────────

  // Code review
  {
    name: 'code-review-checklist',
    type: 'power',
    description: 'Step-by-step code review checklist for pull requests',
    purpose: 'Follow when reviewing any pull request',
    tags: ['code-review', 'quality', 'pr', 'checklist'],
    extraFiles: [],
    versions: 3,
  },
  {
    name: 'security-review',
    type: 'power',
    description: 'Security-focused review steps for sensitive code changes',
    purpose: 'Follow when reviewing code that handles auth, secrets, or user data',
    tags: ['security', 'review', 'audit', 'checklist'],
    extraFiles: [],
    versions: 2,
  },

  // Development workflows
  {
    name: 'feature-branch-workflow',
    type: 'power',
    description: 'Branch naming, commit conventions, and merge process',
    purpose: 'Follow when starting work on a new feature',
    tags: ['git', 'branching', 'workflow', 'commits'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'bug-triage-process',
    type: 'power',
    description: 'Steps for triaging, reproducing, and prioritizing bug reports',
    purpose: 'Follow when a new bug report comes in',
    tags: ['bugs', 'triage', 'debugging', 'process'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'incident-response',
    type: 'power',
    description: 'Production incident response steps from detection to postmortem',
    purpose: 'Follow when a production incident is detected',
    tags: ['incidents', 'response', 'production', 'oncall'],
    extraFiles: ['escalation-matrix.md', 'postmortem-template.md'],
    versions: 3,
  },

  // Refactoring
  {
    name: 'extract-service',
    type: 'power',
    description: 'Playbook for extracting a module into a standalone service',
    purpose: 'Follow when splitting a monolith into services',
    tags: ['refactoring', 'microservices', 'extraction', 'migration'],
    extraFiles: ['pre-extraction-checklist.md'],
    versions: 2,
  },
  {
    name: 'database-migration',
    type: 'power',
    description: 'Safe database migration workflow with zero-downtime deploys',
    purpose: 'Follow when running schema migrations in production',
    tags: ['database', 'migration', 'zero-downtime', 'deployment'],
    extraFiles: ['rollback-plan.md'],
    versions: 2,
  },

  // Testing
  {
    name: 'test-driven-development',
    type: 'power',
    description: 'TDD red-green-refactor cycle with concrete examples',
    purpose: 'Follow when implementing new business logic',
    tags: ['testing', 'tdd', 'workflow', 'development'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'load-testing-playbook',
    type: 'power',
    description: 'Steps for planning, running, and analyzing load tests',
    purpose: 'Follow before any major release or capacity change',
    tags: ['testing', 'load', 'performance', 'capacity'],
    extraFiles: [],
    versions: 1,
  },

  // Deployment
  {
    name: 'canary-deployment',
    type: 'power',
    description: 'Canary deployment process with rollback criteria',
    purpose: 'Follow when deploying to production',
    tags: ['deployment', 'canary', 'rollback', 'production'],
    extraFiles: [],
    versions: 2,
  },
  {
    name: 'feature-flag-workflow',
    type: 'power',
    description: 'Creating, testing, and cleaning up feature flags',
    purpose: 'Follow when gating a feature behind a flag',
    tags: ['feature-flags', 'deployment', 'rollout', 'cleanup'],
    extraFiles: [],
    versions: 1,
  },

  // Onboarding
  {
    name: 'new-dev-onboarding',
    type: 'power',
    description: 'Onboarding steps for new developers joining the team',
    purpose: 'Follow when onboarding a new team member',
    tags: ['onboarding', 'setup', 'team', 'getting-started'],
    extraFiles: ['tools-checklist.md', 'access-requests.md'],
    versions: 2,
  },
  {
    name: 'new-service-checklist',
    type: 'power',
    description: 'Checklist for spinning up a new production service',
    purpose: 'Follow when creating a new microservice',
    tags: ['service', 'checklist', 'setup', 'production'],
    extraFiles: ['observability-setup.md'],
    versions: 1,
  },

  // Documentation
  {
    name: 'write-technical-doc',
    type: 'power',
    description: 'Process for writing clear technical documentation',
    purpose: 'Follow when creating or updating technical docs',
    tags: ['documentation', 'writing', 'technical', 'process'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'api-changelog-process',
    type: 'power',
    description: 'Steps for documenting API changes and notifying consumers',
    purpose: 'Follow when releasing API changes',
    tags: ['api', 'changelog', 'communication', 'release'],
    extraFiles: [],
    versions: 2,
  },

  // Agent
  {
    name: 'agent-tool-selection',
    type: 'power',
    description: 'Decision process for choosing which tools to use',
    purpose: 'Follow when deciding between available tools for a task',
    tags: ['agent', 'tools', 'decision', 'workflow'],
    extraFiles: [],
    versions: 1,
  },
  {
    name: 'spec-authoring-workflow',
    type: 'power',
    description: 'End-to-end workflow for creating and publishing a spectrl spec',
    purpose: 'Follow when authoring a new spec or power',
    tags: ['spectrl', 'authoring', 'publishing', 'workflow'],
    extraFiles: [],
    versions: 2,
  },
];

// ---------------------------------------------------------------------------
// Username generation
// ---------------------------------------------------------------------------

function generateUsernames(count: number): string[] {
  const names = new Set<string>();
  // Always include the "spectrl" org account
  names.add('spectrl');
  while (names.size < count) {
    // Mix of styles: first-last, first-initial, org-style
    const style = faker.number.int({ min: 0, max: 2 });
    let name: string;
    if (style === 0) {
      // sarah-chen style
      name = `${faker.person.firstName()}-${faker.person.lastName()}`.toLowerCase();
    } else if (style === 1) {
      // priya-k style
      name = `${faker.person.firstName()}-${faker.person.lastName().charAt(0)}`.toLowerCase();
    } else {
      // org-style: devtools-co, cloud-patterns
      name =
        `${faker.word.adjective({ strategy: 'any-length' })}-${faker.word.noun({ strategy: 'any-length' })}`.toLowerCase();
    }
    // Ensure valid spectrl name format
    name = name.replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    if (name.length >= 3 && name.length <= 30) {
      names.add(name);
    }
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

function generateSpecContent(name: string, description: string): string {
  const overview = faker.lorem.paragraphs(2);
  const principles = faker.helpers
    .multiple(
      () => `- **${faker.word.adjective({ strategy: 'any-length' })}** — ${faker.hacker.phrase()}`,
      { count: { min: 3, max: 5 } },
    )
    .join('\n');
  const conventions = faker.lorem.paragraphs(2);

  const interfaceName = faker.helpers.fake('{{word.noun}}').replace(/^\w/, (c) => c.toUpperCase());
  const fields = faker.helpers
    .multiple(
      () =>
        `  ${faker.word.noun({ strategy: 'any-length' })}: ${faker.helpers.arrayElement(['string', 'number', 'boolean', 'Date', 'string[]', 'Record<string, unknown>'])};`,
      { count: { min: 3, max: 6 } },
    )
    .join('\n');

  return `# ${name}

## Overview

${description}

${overview}

## Principles

${principles}

## Conventions

${conventions}

### Naming

Use descriptive, unambiguous names. Abbreviations are acceptable only when they are
industry-standard (e.g., URL, API, ID).

### Structure

${faker.lorem.paragraph()}

### Error Handling

${faker.lorem.paragraph()}

## Examples

\`\`\`typescript
interface ${interfaceName}Config {
  id: string;
  name: string;
${fields}
}
\`\`\`

${faker.lorem.paragraph()}

## Exceptions

${faker.lorem.paragraph()}

## References

- ${faker.company.catchPhrase()} — internal wiki
- ${faker.company.catchPhrase()} — team standards
`;
}

function generatePowerContent(name: string, description: string): string {
  const whenToUse = faker.lorem.paragraph();
  const stepCount = faker.number.int({ min: 4, max: 7 });
  const steps = Array.from({ length: stepCount }, (_, i) => {
    const verb = faker.hacker.verb();
    const noun = faker.hacker.noun();
    return `### ${i + 1}. ${verb.charAt(0).toUpperCase() + verb.slice(1)} the ${noun}\n\n${faker.lorem.paragraph()}`;
  }).join('\n\n');

  const pitfalls = faker.helpers
    .multiple(() => `- ${faker.hacker.phrase()}`, { count: { min: 3, max: 5 } })
    .join('\n');

  const prereqs = faker.helpers
    .multiple(() => `- ${faker.lorem.sentence()}`, { count: { min: 2, max: 4 } })
    .join('\n');

  return `# ${name}

## When to Use

${description}

${whenToUse}

## Prerequisites

${prereqs}

## Instructions

${steps}

## Common Pitfalls

${pitfalls}

## Related

- ${faker.company.catchPhrase()} — see internal docs
- ${faker.company.catchPhrase()} — team playbook
`;
}

function generateExtraFileContent(filename: string, parentName: string): string {
  const title = filename.replace('.md', '').replace(/-/g, ' ');
  const body = faker.lorem.paragraphs({ min: 2, max: 4 });
  const points = faker.helpers
    .multiple(() => `- ${faker.hacker.phrase()}`, { count: { min: 3, max: 6 } })
    .join('\n');

  return `# ${title}

Supporting document for ${parentName}.

## Overview

${body}

## Key Points

${points}

## Checklist

- [ ] ${faker.lorem.sentence()}
- [ ] ${faker.lorem.sentence()}
- [ ] ${faker.lorem.sentence()}
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function bumpVersion(version: string, kind: 'minor' | 'major'): string {
  const [major, minor] = version.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  return `${major}.${minor + 1}.0`;
}

function getTerraformOutput(name: string): string {
  const result = execSync(`tflocal output -raw ${name}`, {
    cwd: TF_DIR,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  return result;
}

// ---------------------------------------------------------------------------
// Upload logic
// ---------------------------------------------------------------------------

let versionCount = 0;

async function uploadVersion(
  bucket: string,
  table: string,
  username: string,
  item: SeedItem,
  version: string,
  descriptionOverride?: string,
): Promise<void> {
  const description = descriptionOverride ?? item.description;
  const specId = `${username}/${item.name}`;
  const s3Prefix = `specs/${username}/${item.name}/${version}`;

  // Generate content
  const indexContent =
    item.type === 'power'
      ? generatePowerContent(item.name, description)
      : generateSpecContent(item.name, description);

  let allContent = indexContent;
  const fileList = ['index.md'];

  // Extra files
  const extraContents: Record<string, string> = {};
  for (const ef of item.extraFiles) {
    const content = generateExtraFileContent(ef, item.name);
    extraContents[ef] = content;
    allContent += content;
    fileList.push(ef);
  }

  const hash = sha256(allContent);

  // Manifest
  const manifest = {
    name: item.name,
    version,
    type: item.type,
    description,
    files: fileList,
    hash,
    deps: {},
    agent: { purpose: item.purpose, tags: item.tags },
  };

  // Upload manifest to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${s3Prefix}/spectrl.json`,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
    }),
  );

  // Upload index.md
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${s3Prefix}/files/index.md`,
      Body: indexContent,
      ContentType: 'text/markdown',
    }),
  );

  // Upload extra files
  for (const [filename, content] of Object.entries(extraContents)) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${s3Prefix}/files/${filename}`,
        Body: content,
        ContentType: 'text/markdown',
      }),
    );
  }

  // DynamoDB item
  const createdAt = new Date().toISOString();
  const downloads = faker.number.int({ min: 0, max: 5000 });

  try {
    await dynamo.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          specId: { S: specId },
          version: { S: version },
          username: { S: username },
          specName: { S: item.name },
          description: { S: description },
          type: { S: item.type },
          s3Path: { S: s3Prefix },
          hash: { S: hash },
          createdAt: { S: createdAt },
          downloads: { N: String(downloads) },
          allSpecs: { S: 'ALL' },
          agentTags: { L: item.tags.map((t) => ({ S: t })) },
          files: { L: fileList.map((f) => ({ S: f })) },
        },
      }),
    );
  } catch (err: unknown) {
    console.error(`Failed to write to DynamoDB table "${table}":`, err);
    throw err;
  }

  versionCount++;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', short: 'c' },
    'no-clean': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (args.help) {
  console.log(`
Usage: bun infra/scripts/seed-dev-data.ts [options]

Options:
  -c, --count <n>   Number of items to seed (default: all ${SEED_ITEMS.length} curated items)
  --no-clean        Skip cleaning existing data before seeding
  -h, --help        Show this help message
`);
  process.exit(0);
}

const itemLimit = args.count ? Number.parseInt(args.count, 10) : SEED_ITEMS.length;
const shouldClean = !args['no-clean'];

if (args.count && (Number.isNaN(itemLimit) || itemLimit < 1)) {
  console.error('✗ --count must be a positive integer');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanS3(bucket: string): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = list.Contents;
    if (objects && objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
        }),
      );
      deleted += objects.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

async function cleanDynamo(table: string): Promise<number> {
  let deleted = 0;
  let lastKey: Record<string, { S: string }> | undefined;

  try {
    do {
      const scan = await dynamo.send(
        new ScanCommand({
          TableName: table,
          ProjectionExpression: 'specId, version',
          ExclusiveStartKey: lastKey,
        }),
      );

      const items = scan.Items ?? [];
      for (const item of items) {
        await dynamo.send(
          new DeleteItemCommand({
            TableName: table,
            Key: { specId: item.specId, version: item.version },
          }),
        );
        deleted++;
      }

      lastKey = scan.LastEvaluatedKey as typeof lastKey;
    } while (lastKey);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ResourceNotFoundException') {
      // Table doesn't exist yet — nothing to clean
      return 0;
    }
    throw err;
  }

  return deleted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('==========================================');
  console.log('  Spectrl Dev Data Seeding');
  console.log('==========================================');
  console.log('');

  // Get terraform outputs
  console.log('ℹ Getting infrastructure configuration...');
  let bucket: string;
  let table: string;
  try {
    bucket = getTerraformOutput('storage_bucket_name');
    table = getTerraformOutput('specs_table_name');
  } catch {
    console.error(
      '✗ Could not get terraform outputs. Is LocalStack running with terraform deployed?',
    );
    process.exit(1);
  }
  console.log(`✓ Bucket: ${bucket}`);
  console.log(`✓ Table:  ${table}`);
  console.log('');

  // Clean existing data
  if (shouldClean) {
    console.log('ℹ Cleaning existing data...');
    const s3Deleted = await cleanS3(bucket);
    const dynamoDeleted = await cleanDynamo(table);
    console.log(`✓ Cleaned ${s3Deleted} S3 objects and ${dynamoDeleted} DynamoDB items`);
    console.log('');
  }

  // Seed with deterministic faker for reproducibility
  faker.seed(42);

  // Generate usernames with faker
  USERNAMES = generateUsernames(15);
  console.log(`ℹ Generated ${USERNAMES.length} usernames: ${USERNAMES.slice(0, 5).join(', ')}...`);

  const items = SEED_ITEMS.slice(0, itemLimit);
  const specCount = items.filter((i) => i.type === 'spec').length;
  const powerCount = items.filter((i) => i.type === 'power').length;
  console.log(`ℹ Seeding ${specCount} specs and ${powerCount} powers (${items.length} items)...`);
  console.log('');

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const username = USERNAMES[idx % USERNAMES.length];
    const fileInfo =
      item.extraFiles.length > 0 ? `(${item.extraFiles.length + 1} files)` : '(1 file)';
    const verInfo = item.versions > 1 ? `, ${item.versions} versions` : '';

    console.log(
      `  [${idx + 1}/${items.length}] ${item.type}: ${username}/${item.name} ${fileInfo}${verInfo}`,
    );

    // v1.0.0
    await uploadVersion(bucket, table, username, item, '1.0.0');

    // v1.1.0
    if (item.versions >= 2) {
      const v2 = bumpVersion('1.0.0', 'minor');
      await uploadVersion(bucket, table, username, item, v2, `${item.description} (updated)`);
      console.log(`         + v${v2}`);
    }

    // v2.0.0
    if (item.versions >= 3) {
      const v3 = bumpVersion('1.0.0', 'major');
      await uploadVersion(
        bucket,
        table,
        username,
        item,
        v3,
        `${item.description} (major revision)`,
      );
      console.log(`         + v${v3}`);
    }
  }

  console.log('');
  console.log('==========================================');
  console.log('✓ Seeding complete!');
  console.log('');
  console.log(`  Items:    ${items.length} (${specCount} specs + ${powerCount} powers)`);
  console.log(`  Versions: ${versionCount} total`);
  if (shouldClean) console.log('  Cleaned:  yes (existing data removed first)');
  console.log('');
  console.log('  Includes:');
  console.log('    - Single-file and multi-file items');
  console.log('    - Items with 1, 2, and 3 versions');
  console.log('    - Both specs and powers');
  console.log('    - Realistic names, descriptions, and agent metadata');
  console.log('==========================================');
  console.log('');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
