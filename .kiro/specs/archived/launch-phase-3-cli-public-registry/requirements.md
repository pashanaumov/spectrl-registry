# Phase 3: CLI Public Registry Features - Requirements

## Overview

Extend the existing Spectrl CLI to support public registry operations: authentication, publishing to public, installing from public, and discovery.

## Goals

1. Enable users to authenticate with GitHub via CLI
2. Allow publishing specs to public registry
3. Allow installing specs from public registry
4. Provide discovery commands (search, info)
5. Maintain backward compatibility with local registry

## Functional Requirements

### FR-1: Token Management

- Securely store GitHub access tokens on user's machine
- Use OS keychain when available (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Fallback to encrypted file storage if keychain unavailable
- Token persists across CLI sessions

### FR-2: Authentication Commands

- `spectrl login` - Authenticate with GitHub OAuth
- `spectrl logout` - Remove stored token
- `spectrl whoami` - Show current authenticated user

### FR-3: Publishing to Public Registry

- Extend `spectrl publish` with interactive prompt: local or public?
- Require authentication for public publishing
- Auto-populate `agent` field in manifest if missing
- Upload spec to public registry via API
- Show success message with public URL

### FR-4: Installing from Public Registry

- Extend `spectrl install` to support `username/spec` format
- Detect public vs local specs automatically
- Download from public registry (CloudFront)
- Verify content hash
- Update project index with public source

### FR-5: Discovery and Management Commands

- `spectrl search <query>` - Search public registry
- `spectrl info <username/spec>` - Show spec details
- `spectrl list` - Show installed specs (local and public)
- `spectrl unpublish <username/spec@version>` - Remove spec from public registry
- `spectrl update [spec]` - Check for and install spec updates

## Non-Functional Requirements

### NFR-1: Security

- Tokens stored securely (OS keychain or encrypted)
- Never log tokens
- Validate token before use
- Clear error messages for auth failures

### NFR-2: User Experience

- Commands feel natural and intuitive
- Clear prompts and confirmations
- Helpful error messages
- Fast operations (< 2s for most commands)

### NFR-3: Backward Compatibility

- Existing local registry commands still work
- Project indexes remain compatible
- No breaking changes to manifest format

## Acceptance Criteria

### AC-1: Token Management

- [ ] Keytar installed and working
- [ ] Can store token in OS keychain
- [ ] Can retrieve token from keychain
- [ ] Fallback to encrypted file works
- [ ] Token persists across sessions

### AC-2: Authentication Commands

- [ ] `spectrl login` opens browser and completes OAuth
- [ ] Token stored after successful login
- [ ] `spectrl logout` removes token
- [ ] `spectrl whoami` shows username when logged in
- [ ] `spectrl whoami` shows "Not logged in" when not logged in

### AC-3: Publishing to Public

- [ ] `spectrl publish` prompts for destination
- [ ] Can publish to public registry when logged in
- [ ] Error shown if not logged in
- [ ] Success message includes public URL
- [ ] Spec appears on public registry

### AC-4: Installing from Public

- [ ] Can install with `spectrl install username/spec`
- [ ] Can install with `spectrl install username/spec@version`
- [ ] Latest version installed if no version specified
- [ ] Files downloaded from CloudFront
- [ ] Hash verified
- [ ] Project index updated

### AC-5: Discovery and Management Commands

- [ ] `spectrl search` returns relevant results
- [ ] `spectrl info` shows all versions
- [ ] `spectrl list` shows both local and public specs
- [ ] `spectrl unpublish` removes spec from public registry
- [ ] `spectrl update` checks for and installs updates
- [ ] Output is formatted and readable

### AC-6: Backward Compatibility

- [ ] Existing local commands still work
- [ ] Can publish to local registry
- [ ] Can install from local registry
- [ ] Project indexes remain valid

## Out of Scope

- Advanced search filters
- Spec ratings or reviews
- User profiles
- Dependency resolution from public registry (Phase 5)
- Automatic updates
