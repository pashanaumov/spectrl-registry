# Discussion: Local vs Public Spec Namespace Collision

## Problem Statement

What should happen when a user installs a spec from the local registry and then installs a spec with the same name from the public registry (or vice versa)?

### Current Behavior

**Local Spec Installation:**

- Command: `spectrl install my-spec@1.0.0`
- Storage: `.spectrl/specs/my-spec@1.0.0/` (symlink to local registry)
- Index key: `my-spec@1.0.0`
- Source: Local registry path (e.g., `/path/to/.spectrl/registry/my-spec/1.0.0`)

**Public Spec Installation:**

- Command: `spectrl install alice/my-spec@1.0.0`
- Storage: `.spectrl/specs/alice-my-spec@1.0.0/` (downloaded files)
- Index key: `alice/my-spec@1.0.0`
- Source: HTTPS URL (e.g., `https://registry.com/specs/alice/my-spec/1.0.0/spectrl.json`)

**Result:** Both specs coexist in different directories with different index keys. No collision occurs.

## Issues Identified

### 1. Materialization Inconsistency

**Local specs** are materialized to the local registry (`.spectrl/registry/`) and then symlinked to the project.

**Public specs** are downloaded directly to the project directory (`.spectrl/specs/`) without going through the registry.

**Problem:** This creates an asymmetry:

- Local specs can be shared across projects via the registry
- Public specs are duplicated in every project that uses them
- No unified "source of truth" for installed specs

### 2. Namespace Ambiguity

If a user has:

- `my-spec@1.0.0` (local, unpublished)
- `alice/my-spec@1.0.0` (public, published by alice)

Are these the same spec or different specs?

**Scenarios:**

1. **Same spec, different sources**: Alice published `my-spec` that you're developing locally
2. **Different specs, same name**: Coincidental name collision
3. **Forked spec**: You forked Alice's spec and modified it locally

### 3. Dependency Resolution Confusion

If a spec declares a dependency on `my-spec@1.0.0`, which one should be used?

- The local one?
- The public one from alice?
- Should it error?

## Proposed Solutions

### Option A: Strict Namespace Separation (Current Implementation)

**Approach:** Treat local and public specs as completely separate namespaces.

**Rules:**

- Local specs: `name@version` (no username)
- Public specs: `username/name@version` (always include username)
- Dependencies must specify the full reference (including username for public specs)

**Pros:**

- Simple to implement (already done)
- No ambiguity - different keys = different specs
- Users can have both local and public versions

**Cons:**

- Public specs not materialized to registry (duplication across projects)
- Dependencies must know if they're referencing local or public specs
- No way to "upgrade" from local to public

### Option B: Materialize Public Specs to Local Registry

**Approach:** Download public specs to the local registry, then treat them like local specs.

**Implementation:**

```
1. Download public spec from S3/CloudFront
2. Materialize to `.spectrl/registry/username-name/version/`
3. Create symlink from `.spectrl/specs/username-name@version/` to registry
4. Update index with registry path as source (not HTTPS URL)
```

**Pros:**

- Unified storage model - all specs go through registry
- Public specs can be shared across projects
- Consistent behavior for local and public specs
- Enables offline usage after first download

**Cons:**

- More complex implementation
- Registry path needs to encode username to avoid collisions
- Need to handle registry updates when public spec changes

### Option C: Collision Detection with User Prompt (RECOMMENDED)

**Approach:** Detect when installing a spec that conflicts with an existing spec and prompt the user.

**Rules:**

- If `my-spec@1.0.0` exists locally and user tries to install `alice/my-spec@1.0.0`, prompt:

  ```
  Warning: A local spec 'my-spec@1.0.0' already exists.
  Installing 'alice/my-spec@1.0.0' may cause confusion in dependency resolution.

  Do you want to:
  1. Replace local spec with public spec (removes my-spec@1.0.0, installs alice/my-spec@1.0.0)
  2. Cancel installation
  ```

- Similarly, if `alice/my-spec@1.0.0` exists and user tries to install local `my-spec@1.0.0`:

  ```
  Warning: A public spec 'alice/my-spec@1.0.0' is already installed.
  Installing local 'my-spec@1.0.0' may cause confusion in dependency resolution.

  Do you want to:
  1. Replace public spec with local spec (removes alice/my-spec@1.0.0, installs my-spec@1.0.0)
  2. Cancel installation
  ```

**Non-interactive mode (CI/CD):**

- Always fail with clear error message
- No `--force` flag - collision is a real problem that needs fixing
- Error message explains the issue and suggests resolution steps

**Example CI error:**

```
Error: Spec name collision detected
  Local spec 'my-spec@1.0.0' already exists
  Attempted to install public spec 'alice/my-spec@1.0.0'

This collision will cause ambiguity in dependency resolution.

To resolve:
  1. Remove the local spec: spectrl uninstall my-spec@1.0.0
  2. Or remove the public spec from your index
  3. Then retry the installation

Exit code: 1 (VALIDATION_ERROR)
```

**Pros:**

- User has control over conflicts in interactive mode
- CI/CD fails fast, highlighting configuration issues
- Prevents accidental confusion
- Clear communication about what's happening
- Simple two-choice UX (replace or cancel)
- Safer default behavior
- No escape hatch that could hide problems

**Cons:**

- Requires interactive prompts (but that's fine - CI should fail)
- Need to detect name collisions
- Need to handle non-interactive mode (but we want it to fail)

### Option D: Hash-Based Deduplication

**Approach:** If local and public specs have the same hash, treat them as identical.

**Rules:**

- When installing `alice/my-spec@1.0.0`, check if `my-spec@1.0.0` exists locally
- If hashes match, create an alias in the index pointing to the same storage
- If hashes differ, treat as separate specs (Option A)

**Pros:**

- Automatic deduplication when specs are identical
- No user intervention needed
- Storage efficient

**Cons:**

- Complex implementation
- Need to handle aliasing in dependency resolution
- What if hashes match but sources are different?

## Recommendation

**Preferred Approach:** **Option C** (Collision Detection with User Prompt)

**Rationale:**

- Prevents confusion in dependency resolution
- Gives users explicit control
- Simple two-choice UX (replace or cancel)
- Can be bypassed with `--force` flag for CI/CD
- Safer than silent coexistence

**Implementation Priority:**

1. **Phase 1 (Current):** Option A - Allow coexistence (MVP shipped)
2. **Phase 2 (Next):** Option C - Add collision detection with prompts
3. **Phase 3 (Future):** Option B - Materialize public specs to registry for consistency
4. **Phase 4 (Future):** Option D - Hash-based deduplication for efficiency

## Implementation Plan for Option C (Collision Detection)

### Phase 1: Detection Logic

1. **Add collision detection helper:**

   ```typescript
   async function detectSpecCollision(
     name: string,
     version: string,
     isPublic: boolean,
     cwd: string,
   ): Promise<{
     hasCollision: boolean;
     existingType: 'local' | 'public' | null;
     existingPath: string | null;
   }> {
     const projectIndexPath = getProjectIndexPath(cwd);
     const indexContent = await fs.readFile(projectIndexPath, 'utf-8');
     const index = JSON.parse(indexContent);

     // Check for opposite type
     if (isPublic) {
       // Installing public, check for local
       const localKey = `${name}@${version}`;
       if (index[localKey]) {
         return {
           hasCollision: true,
           existingType: 'local',
           existingPath: join(cwd, '.spectrl', 'specs', localKey),
         };
       }
     } else {
       // Installing local, check for public (any username)
       for (const key of Object.keys(index)) {
         if (key.includes('/') && key.endsWith(`/${name}@${version}`)) {
           return {
             hasCollision: true,
             existingType: 'public',
             existingPath: join(cwd, '.spectrl', 'specs', key.replace('/', '-')),
           };
         }
       }
     }

     return { hasCollision: false, existingType: null, existingPath: null };
   }
   ```

2. **Add user prompt helper:**

   ```typescript
   import prompts from 'prompts';

   async function promptCollisionResolution(
     name: string,
     version: string,
     existingType: 'local' | 'public',
     newType: 'local' | 'public',
   ): Promise<'replace' | 'cancel'> {
     const response = await prompts({
       type: 'select',
       name: 'action',
       message: `Warning: A ${existingType} spec '${name}@${version}' already exists.\nInstalling ${newType} spec may cause confusion in dependency resolution.`,
       choices: [
         { title: `Replace ${existingType} spec with ${newType} spec`, value: 'replace' },
         { title: 'Cancel installation', value: 'cancel' },
       ],
       initial: 1, // Default to cancel for safety
     });

     return response.action || 'cancel';
   }
   ```

### Phase 2: Integrate into Install Functions

1. **Modify `installSingleSpec()`:**

   ```typescript
   export async function installSingleSpec(
     specRef: string,
     options: { cwd: string; registry?: string },
   ): Promise<void> {
     const { cwd, registry: registryPath } = options;

     // ... existing parsing logic ...

     // Detect collision
     const collision = await detectSpecCollision(
       parsed.name,
       parsed.version || 'latest',
       parsed.isPublic,
       cwd,
     );

     if (collision.hasCollision) {
       // Check if running in non-interactive mode (CI/CD)
       if (!process.stdin.isTTY) {
         const existingSpec =
           collision.existingType === 'local'
             ? `${parsed.name}@${parsed.version}`
             : `<username>/${parsed.name}@${parsed.version}`;
         const newSpec = parsed.isPublic
           ? `${parsed.username}/${parsed.name}@${parsed.version}`
           : `${parsed.name}@${parsed.version}`;

         throw new CLIError(
           `Spec name collision detected\n` +
             `  ${collision.existingType === 'local' ? 'Local' : 'Public'} spec '${existingSpec}' already exists\n` +
             `  Attempted to install ${parsed.isPublic ? 'public' : 'local'} spec '${newSpec}'\n\n` +
             `This collision will cause ambiguity in dependency resolution.\n\n` +
             `To resolve:\n` +
             `  1. Remove the ${collision.existingType} spec: spectrl uninstall ${existingSpec}\n` +
             `  2. Or remove the ${parsed.isPublic ? 'public' : 'local'} spec from your index\n` +
             `  3. Then retry the installation`,
           ExitCode.VALIDATION_ERROR,
         );
       }

       // Interactive mode: prompt user
       const action = await promptCollisionResolution(
         parsed.name,
         parsed.version || 'latest',
         collision.existingType!,
         parsed.isPublic ? 'public' : 'local',
       );

       if (action === 'cancel') {
         throw new CLIError('Installation cancelled by user', ExitCode.USER_CANCELLED);
       }

       // User chose to replace: remove existing spec
       spinner.text = `Removing existing ${collision.existingType} spec`;
       await removeExistingPath(collision.existingPath!);

       // Remove from index
       const indexPath = getProjectIndexPath(cwd);
       const indexContent = await fs.readFile(indexPath, 'utf-8');
       const index = JSON.parse(indexContent);

       // Find and remove the existing key
       for (const key of Object.keys(index)) {
         if (
           (collision.existingType === 'local' && key === `${parsed.name}@${parsed.version}`) ||
           (collision.existingType === 'public' &&
             key.endsWith(`/${parsed.name}@${parsed.version}`))
         ) {
           delete index[key];
           break;
         }
       }

       await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');
     }

     // ... continue with normal installation ...
   }
   ```

2. **Update CLI (no --force flag needed):**
   ```typescript
   // In cli.ts
   .command('install [spec]')
   .action(async (spec, options) => {
     // installSingleSpec will handle collision detection
     // Interactive: prompts user
     // Non-interactive: fails with clear error
   });
   ```

### Phase 3: Add Exit Code

```typescript
// In errors.ts
export enum ExitCode {
  // ... existing codes ...
  USER_CANCELLED = 130, // Standard exit code for user cancellation
}
```

### Phase 4: Testing

1. Test collision detection logic
2. Test user prompt flow in interactive mode (mock prompts library)
3. Test non-interactive mode fails with clear error message
4. Test replacement removes old spec and installs new one
5. Test cancellation exits cleanly with USER_CANCELLED code
6. Test CI scenario: set `process.stdin.isTTY = false` and verify error

## Implementation Plan for Option B (Future)

### Phase 1: Materialize Public Specs to Registry

1. **Modify `installFromPublic()` function:**

   ```typescript
   // Instead of writing directly to .spectrl/specs/
   // Write to .spectrl/registry/username-name/version/
   const registrySpecPath = join(registryPath, `${username}-${name}`, version);

   // Create registry structure
   await fse.ensureDir(join(registrySpecPath, 'files'));

   // Write manifest to registry
   await fs.writeFile(join(registrySpecPath, 'spectrl.json'), JSON.stringify(manifest, null, 2));

   // Write files to registry/files/
   for (const filePath of manifest.files) {
     const destFile = join(registrySpecPath, 'files', filePath);
     await fse.ensureDir(dirname(destFile));
     await fs.writeFile(destFile, content, 'utf-8');
   }
   ```

2. **Create symlink from project to registry:**

   ```typescript
   // Create symlink from .spectrl/specs/ to registry
   const projectSymlinkPath = join(cwd, '.spectrl', 'specs', `${username}-${name}@${version}`);

   const registryFilesPath = join(registrySpecPath, 'files');

   await createSymlinkOrFallback(registryFilesPath, projectSymlinkPath, manifest, spinner);
   ```

3. **Update project index with registry path:**
   ```typescript
   // Store registry path as source, not HTTPS URL
   index[`${username}/${name}@${version}`] = {
     source: registrySpecPath,
     hash: versionMeta.hash,
   };
   ```

### Phase 2: Handle Updates and Cache Invalidation

1. Add `spectrl update username/spec` command to re-download from public registry
2. Add cache TTL or version checking
3. Add `spectrl cache clean` command to remove downloaded public specs

### Phase 3: Offline Support

1. Check registry before downloading from public
2. Allow installation from registry even when offline
3. Add `--prefer-offline` flag

## Questions for Discussion

1. **Should public specs be materialized to the local registry?**
   - Pro: Consistency, sharing across projects, offline support
   - Con: More complex, registry grows larger

2. **How should we handle name collisions?**
   - Strict separation (current)?
   - Collision detection with prompts?
   - Hash-based deduplication?

3. **Should dependencies be able to reference both local and public specs?**
   - If yes, how do we resolve `my-spec@1.0.0` in deps?
   - Should we require `username/name@version` for public specs in deps?

4. **What about spec updates?**
   - Should `spectrl install alice/my-spec` check for updates?
   - Or should it only install once and require explicit `spectrl update`?

5. **Registry storage format for public specs:**
   - `registry/username-name/version/` (current approach)
   - `registry/public/username/name/version/` (separate namespace)
   - `registry/name/version/` with metadata about source (collision risk)

## Next Steps

1. Get feedback on preferred approach
2. Create test cases for chosen behavior
3. Update implementation if needed
4. Document the behavior in user-facing docs
