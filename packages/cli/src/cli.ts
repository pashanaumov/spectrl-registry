#!/usr/bin/env node

import { command, subcommands, run, positional, option, string, optional, flag } from 'cmd-ts';
import { init } from './commands/init/index.js';
import { publish } from './commands/publish/index.js';
import { install, installSingleSpec } from './commands/install/index.js';
import { newContent } from './commands/new/index.js';
import { login } from './commands/login/index.js';
import { logout } from './commands/logout/index.js';
import { whoami } from './commands/whoami/index.js';
import { unpublish } from './commands/unpublish/index.js';
import { update } from './commands/update/index.js';
import { search } from './commands/search/index.js';
import { info } from './commands/info/index.js';
import { list } from './commands/list/index.js';
import { CLIError, formatError, getExitCode } from './errors.js';
import { output } from './utils.js';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

/**
 * Initialize command - creates a new project index
 */
const initCmd = command({
  name: 'init',
  description: 'Initialize a new project with a local spec index',
  args: {
    skipAgents: flag({
      long: 'skip-agents',
      description: 'Skip AGENTS.md creation/update entirely',
      defaultValue: () => false,
    }),
    forceAgents: flag({
      long: 'force-agents',
      description: 'Force overwrite AGENTS.md with fresh template',
      defaultValue: () => false,
    }),
  },
  handler: async (args) => {
    await init(process.cwd(), {
      skipAgents: args.skipAgents,
      forceAgents: args.forceAgents,
    });
  },
});

/**
 * Publish command - publishes a spec to the local registry
 */
const publishCmd = command({
  name: 'publish',
  description: 'Publish a spec to the local registry',
  args: {},
  handler: async () => {
    await publish(process.cwd());
  },
});

/**
 * Install command - installs all specs from the project index or a specific spec
 */
const installCmd = command({
  name: 'install',
  description:
    'Install specs using symlinks to the registry. Creates links from .spectrl/specs/{name}@{version}/ to the registry. On Windows, uses junction points (no admin required). Falls back to file copying if symlinks fail.',
  args: {
    specRef: positional({
      type: optional(string),
      displayName: 'spec',
      description: 'Optional spec reference (name@version) to install from registry',
    }),
  },
  handler: async (args) => {
    if (args.specRef) {
      await installSingleSpec(args.specRef, { cwd: process.cwd() });
    } else {
      await install({ cwd: process.cwd() });
    }
  },
});

/**
 * `spectrl new [spec|power] <name>` — scaffold a spec or power
 */
const newCmd = command({
  name: 'new',
  description:
    'Create a new spec or power (defaults to spec). Usage: spectrl new [spec|power] <name>',
  args: {
    first: positional({
      type: optional(string),
      displayName: 'type-or-name',
      description: 'Content type (spec|power) or name if type is omitted',
    }),
    second: positional({
      type: optional(string),
      displayName: 'name',
      description: 'Name (if first arg is the type)',
    }),
    version: option({
      type: optional(string),
      long: 'version',
      description: 'Initial version (default: 0.1.0)',
      defaultValue: () => '0.1.0',
    }),
    description: option({
      type: optional(string),
      long: 'description',
      description: 'Description',
    }),
  },
  handler: async (args) => {
    let type: 'spec' | 'power' = 'spec';
    let name: string | undefined;

    if (args.first === 'spec' || args.first === 'power') {
      type = args.first;
      name = args.second;
    } else if (args.first) {
      name = args.first;
    } else {
      // No args at all — prompt for type
      const { select } = await import('@inquirer/prompts');
      type = await select({
        message: 'What do you want to create?',
        choices: [
          {
            value: 'spec' as const,
            name: 'Spec',
            description:
              'Structured knowledge — a PRD, TDD, ADR, or any document agents can consume',
          },
          {
            value: 'power' as const,
            name: 'Power',
            description:
              'Agent instructions — reusable workflow rules that steer how an agent behaves',
          },
        ],
      });
    }

    if (!name) {
      const { input } = await import('@inquirer/prompts');
      name = await input({
        message: `${type === 'power' ? 'Power' : 'Spec'} name (lowercase, hyphens ok):`,
        validate: (val) => {
          if (!val.trim()) return 'Name is required';
          if (!/^[a-z0-9-]+$/.test(val.trim()))
            return 'Must be lowercase alphanumeric with hyphens';
          return true;
        },
      });
      name = name.trim();
    }

    await newContent(name, process.cwd(), type, args.version, args.description);
  },
});

/**
 * Login command - authenticate with GitHub using Device Flow
 */
const loginCmd = command({
  name: 'login',
  description: 'Authenticate with GitHub to access the public registry',
  args: {},
  handler: async () => {
    await login();
  },
});

/**
 * Logout command - remove stored GitHub token
 */
const logoutCmd = command({
  name: 'logout',
  description: 'Remove stored GitHub authentication token',
  args: {},
  handler: async () => {
    await logout();
  },
});

/**
 * Whoami command - show current authenticated user
 */
const whoamiCmd = command({
  name: 'whoami',
  description: 'Show current authenticated GitHub user',
  args: {},
  handler: async () => {
    await whoami();
  },
});

/**
 * Unpublish command - remove a spec version from the public registry
 */
const unpublishCmd = command({
  name: 'unpublish',
  description: 'Remove a spec version from the public registry (requires authentication)',
  args: {
    specRef: positional({
      type: string,
      displayName: 'spec',
      description: 'Spec reference in format username/spec@version',
    }),
  },
  handler: async (args) => {
    await unpublish(args.specRef);
  },
});

/**
 * Update command - check for and install spec updates
 */
const updateCmd = command({
  name: 'update',
  description: 'Check for and install updates for public specs',
  args: {
    specRef: positional({
      type: optional(string),
      displayName: 'spec',
      description: 'Optional spec reference to update (username/spec or username/spec@version)',
    }),
    all: flag({
      long: 'all',
      description: 'Update all specs with available updates',
      defaultValue: () => false,
    }),
  },
  handler: async (args) => {
    await update(args.specRef, { all: args.all, cwd: process.cwd() });
  },
});

/**
 * Search command - search for specs in the public registry
 */
const searchCmd = command({
  name: 'search',
  description: 'Search for specs in the public registry',
  args: {
    query: positional({
      type: string,
      displayName: 'query',
      description: 'Search query (keywords, tags, or spec names)',
    }),
  },
  handler: async (args) => {
    await search(args.query);
  },
});

/**
 * Info command - show detailed information about a spec
 */
const infoCmd = command({
  name: 'info',
  description: 'Show detailed information about a spec from the public registry',
  args: {
    specRef: positional({
      type: string,
      displayName: 'spec',
      description: 'Spec reference in format username/spec',
    }),
  },
  handler: async (args) => {
    await info(args.specRef);
  },
});

/**
 * List command - show all installed specs
 */
const listCmd = command({
  name: 'list',
  description: 'Show all installed specs (local and public)',
  args: {},
  handler: async () => {
    await list({ cwd: process.cwd() });
  },
});

/**
 * Main CLI application with subcommands
 */
const app = subcommands({
  name: 'spectrl',
  description: 'Local-first spec registry',
  version,
  cmds: {
    init: initCmd,
    new: newCmd,
    publish: publishCmd,
    install: installCmd,
    login: loginCmd,
    logout: logoutCmd,
    whoami: whoamiCmd,
    unpublish: unpublishCmd,
    update: updateCmd,
    search: searchCmd,
    info: infoCmd,
    list: listCmd,
  },
});

/**
 * Print styled help output when no subcommand is given
 */
function printHelp(): void {
  const commands = [
    ['init', 'Initialize a new project with a local spec index'],
    ['new', 'Create a new spec with a manifest template'],
    ['publish', 'Publish a spec to the local registry'],
    ['install', 'Install specs from the registry into .spectrl/specs/'],
    ['login', 'Authenticate with GitHub to access the public registry'],
    ['logout', 'Remove stored GitHub authentication token'],
    ['whoami', 'Show current authenticated GitHub user'],
    ['unpublish', 'Remove a spec version from the public registry'],
    ['update', 'Check for and install updates for public specs'],
    ['search', 'Search for specs in the public registry'],
    ['info', 'Show detailed information about a spec'],
    ['list', 'Show all installed specs (local and public)'],
  ] as const;

  const cmdWidth = Math.max(...commands.map(([name]) => name.length)) + 2;

  output.log('');
  output.log(
    `  ${chalk.bold('spectrl')} ${chalk.dim(`v${version}`)}  ${chalk.dim('·')}  Local-first spec registry`,
  );
  output.log('');
  output.log(
    `  ${chalk.dim('Usage:')}  spectrl ${chalk.cyan('<command>')} ${chalk.dim('[options]')}`,
  );
  output.log('');
  output.log(`  ${chalk.dim('Commands:')}`);
  output.log('');
  for (const [name, desc] of commands) {
    output.log(`    ${chalk.cyan(name.padEnd(cmdWidth))}${chalk.dim(desc)}`);
  }
  output.log('');
  output.log(`  Run ${chalk.cyan('spectrl <command> --help')} for command-specific options.`);
  output.log('');
}

/**
 * Run the CLI with error handling
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  try {
    await run(app, args);
  } catch (error) {
    // Handle CLIError with proper exit codes
    if (error instanceof CLIError) {
      output.error(formatError(error));
      process.exit(error.exitCode);
    }

    // Handle unknown errors
    if (error instanceof Error) {
      output.error(formatError(error));
      process.exit(getExitCode(error));
    }

    // Fallback for non-Error objects
    output.error('Unknown error occurred');
    process.exit(1);
  }
}

main();
