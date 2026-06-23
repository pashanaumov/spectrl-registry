# Publishing Guide

This project publishes `spectrl` (unscoped package) to npm. The CLI bundles all internal dependencies.

## Quick Release

```bash
# 1. Bump version (patch/minor/major)
pnpm version:patch  # or version:minor, or version:major

# 2. Build and publish
pnpm release

# 3. Push to GitHub
git push && git push --tags
```

## Detailed Workflow

### 1. Version Bump

Choose the appropriate version bump from the root directory:

```bash
# Patch (0.5.1 → 0.5.2) - Bug fixes
pnpm version:patch

# Minor (0.5.1 → 0.6.0) - New features, backwards compatible
pnpm version:minor

# Major (0.5.1 → 1.0.0) - Breaking changes
pnpm version:major
```

This will:

- Update `packages/cli/package.json` version
- Create a git commit with the version
- Create a git tag (e.g., `v0.5.2`)

### 2. Build and Publish

From the root directory:

```bash
pnpm release
```

This will:

- Build the CLI with esbuild (bundles core + schema)
- Publish `spectrl` to npm
- The bundled file is ~247KB

### 3. Push to GitHub

```bash
git push && git push --tags
```

## What Gets Published

The `spectrl` package (unscoped) is published to npm. It includes:

- Bundled code from `@spectrl/core` and `@spectrl/schema`
- External dependencies: chalk, ora, cmd-ts, fs-extra, @inquirer/prompts

Internal packages (`@spectrl/core`, `@spectrl/schema`, `api`) are marked as private and won't publish.

## Pre-publish Checklist

- [ ] All tests passing (`pnpm test`)
- [ ] Code formatted (`pnpm format`)
- [ ] Linting passes (`pnpm lint`)
- [ ] E2E tests pass (`pnpm test:e2e`)
- [ ] Version bumped appropriately
- [ ] Git working directory clean

## First Time Setup

### 1. Login to npm

```bash
npm login
```

You'll need:

- npm account (create at https://www.npmjs.com/signup)
- Username, password, email (must be verified)
- 2FA code (if enabled)

### 2. Verify npm Account

```bash
npm whoami
```

## Troubleshooting

### "You do not have permission to publish"

Make sure you're logged in:

```bash
npm whoami
npm logout
npm login
```

### "402 Payment Required"

Scoped packages require `--access public` flag. This is already configured in the CLI package.json.

### Build Fails

Make sure you have Bun installed (used for the build script):

```bash
curl -fsSL https://bun.sh/install | bash
```

## Version Strategy

- **Patch (0.0.x)**: Bug fixes, no breaking changes
- **Minor (0.x.0)**: New features, no breaking changes
- **Major (x.0.0)**: Breaking changes

## After Publishing

Verify the package:

```bash
# Test with npx
spr-registry --version

# Or install globally and test
npm install -g spectrl-registry-registry
spectrl --version
npm uninstall -g spectrl-registry-registry
```

## npm Package Link

After publishing, your package will be available at:

- https://www.npmjs.com/package/spectrl
