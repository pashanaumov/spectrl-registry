# Part 3: Installing & Managing Specs

## 6. INSTALL COMMAND

### 6.1 Install - Single Spec (Local Registry)

- [ ] Publish spec locally: `test-spec@1.0.0`
- [ ] Create new project, run `spectrl init`
- [ ] Run: `spectrl install test-spec`
- [ ] Verify spec installed in `.spectrl/specs/test-spec@1.0.0/`
- [ ] Verify files present
- [ ] Verify symlink created (or files copied on Windows)
- [ ] Verify lock file updated
- [ ] Verify index updated

### 6.2 Install - Specific Version

- [ ] Publish versions 1.0.0, 1.1.0, 2.0.0
- [ ] Install: `spectrl install test-spec@1.0.0`
- [ ] Verify correct version installed
- [ ] Install: `spectrl install test-spec@2.0.0`
- [ ] Verify both versions coexist
- [ ] Install latest: `spectrl install test-spec`
- [ ] Verify latest version installed

### 6.3 Install - Public Registry

- [ ] Login to public registry
- [ ] Install: `spectrl install username/spec-name`
- [ ] Verify downloaded from public registry
- [ ] Verify files present locally
- [ ] Verify hash validated
- [ ] Verify lock file records source
- [ ] Install specific version: `username/spec@1.0.0`

### 6.4 Install - With Dependencies

- [ ] Create spec A (no deps)
- [ ] Create spec B (depends on A)
- [ ] Publish both
- [ ] Install B: `spectrl install spec-b`
- [ ] Verify A automatically installed
- [ ] Verify both in lock file
- [ ] Verify dependency tree correct

### 6.5 Install - Transitive Dependencies

- [ ] Create spec A (no deps)
- [ ] Create spec B (depends on A)
- [ ] Create spec C (depends on B)
- [ ] Publish all three
- [ ] Install C: `spectrl install spec-c`
- [ ] Verify A and B automatically installed
- [ ] Verify all in lock file
- [ ] Verify correct versions resolved

### 6.6 Install - All Specs from Index

- [ ] Create project with spectrl-index.json
- [ ] Add multiple specs to index
- [ ] Run: `spectrl install` (no args)
- [ ] Verify all specs installed
- [ ] Verify lock file created
- [ ] Verify all dependencies resolved
- [ ] Run install again (should be idempotent)

### 6.7 Install - Symlinks vs Copy

- [ ] On macOS/Linux: verify symlinks created
- [ ] On Windows: verify junction points created
- [ ] Verify symlink points to registry
- [ ] Modify file in registry, verify reflected in install
- [ ] Test fallback to copy if symlink fails
- [ ] Verify copy mode works correctly

### 6.8 Install - Version Conflicts

- [ ] Spec A depends on C@1.0.0
- [ ] Spec B depends on C@2.0.0
- [ ] Try install both A and B
- [ ] Verify conflict detected
- [ ] Verify clear error message
- [ ] Verify suggests resolution

### 6.9 Install - Circular Dependencies

- [ ] Create spec A (depends on B)
- [ ] Create spec B (depends on A)
- [ ] Try install A
- [ ] Verify circular dependency detected
- [ ] Verify clear error message
- [ ] Verify doesn't hang/loop

### 6.10 Install - Missing Dependencies

- [ ] Create spec with dependency on non-existent spec
- [ ] Try install
- [ ] Verify missing dependency detected
- [ ] Verify clear error message
- [ ] Verify lists missing dependency

### 6.11 Install - Hash Validation

- [ ] Install spec with valid hash
- [ ] Manually corrupt installed file
- [ ] Try install again
- [ ] Verify hash mismatch detected
- [ ] Verify re-downloads/re-installs
- [ ] Verify integrity restored

### 6.12 Install - Edge Cases

- [ ] Install without internet (local only)
- [ ] Install with slow connection
- [ ] Install with network interruption mid-download
- [ ] Install with API down
- [ ] Install with disk full
- [ ] Install without write permissions
- [ ] Install in read-only filesystem
- [ ] Install very large spec (>100MB)
- [ ] Install spec with many files (>1000)
- [ ] Install same spec twice (idempotent)
- [ ] Install after manual registry corruption
