# Part 2: Publishing & Registry Management

## 4. PUBLISH COMMAND

### 4.1 Publish - First Time (Local Registry)

- [ ] Create spec with `spectrl new test-spec`
- [ ] Add content files (README.md, docs/)
- [ ] Update spectrl.json with files list
- [ ] Run: `spectrl publish`
- [ ] Verify success message
- [ ] Verify spec in `.spectrl/registry/test-spec/versions/0.1.0/`
- [ ] Verify all files copied
- [ ] Verify hash generated correctly
- [ ] Verify manifest includes hash

### 4.2 Publish - Multiple Versions

- [ ] Publish version 0.1.0
- [ ] Update version to 0.2.0
- [ ] Publish version 0.2.0
- [ ] Verify both versions in registry
- [ ] Update to 1.0.0
- [ ] Publish version 1.0.0
- [ ] Verify all three versions exist
- [ ] Verify each has correct files

### 4.3 Publish - Public Registry (Authenticated)

- [ ] Login: `spectrl login`
- [ ] Create spec with username prefix
- [ ] Publish to public registry
- [ ] Verify success message
- [ ] Verify spec appears on web
- [ ] Publish new version
- [ ] Verify new version on web
- [ ] Verify download count increments

### 4.4 Publish - Validation Errors

- [ ] Publish without spectrl.json (should fail)
- [ ] Publish with invalid JSON (should fail)
- [ ] Publish with missing required fields (should fail)
- [ ] Publish with invalid version format (should fail)
- [ ] Publish with missing files (should fail)
- [ ] Publish with files outside directory (should fail)
- [ ] Publish with empty files array (should fail)
- [ ] Publish with duplicate version (should fail)

### 4.5 Publish - File Handling

- [ ] Publish with single file
- [ ] Publish with multiple files
- [ ] Publish with nested directories
- [ ] Publish with symlinks
- [ ] Publish with binary files
- [ ] Publish with large files (>10MB)
- [ ] Publish with many files (>100)
- [ ] Publish with .gitignore (should respect or not?)
- [ ] Publish with hidden files (.dotfiles)

### 4.6 Publish - Edge Cases

- [ ] Publish without internet (local should work)
- [ ] Publish to public without auth (should fail)
- [ ] Publish with network interruption
- [ ] Publish with API down
- [ ] Publish with disk full
- [ ] Publish from git repo (dirty vs clean)
- [ ] Publish with uncommitted changes
- [ ] Publish from subdirectory
- [ ] Publish same version twice
- [ ] Publish with invalid hash

## 5. UNPUBLISH COMMAND

### 5.1 Unpublish - Happy Path

- [ ] Publish spec: `username/test-spec@1.0.0`
- [ ] Verify on web
- [ ] Run: `spectrl unpublish username/test-spec@1.0.0`
- [ ] Verify success message
- [ ] Verify removed from web
- [ ] Verify 404 on web for that version
- [ ] Verify other versions still available

### 5.2 Unpublish - Authorization

- [ ] Try unpublish own spec (should work)
- [ ] Try unpublish someone else's spec (should fail)
- [ ] Try unpublish without login (should fail)
- [ ] Try unpublish with expired token (should fail)
- [ ] Try unpublish with invalid token (should fail)

### 5.3 Unpublish - Edge Cases

- [ ] Unpublish non-existent spec (should fail gracefully)
- [ ] Unpublish non-existent version (should fail gracefully)
- [ ] Unpublish last remaining version
- [ ] Unpublish with network down
- [ ] Unpublish with API down
- [ ] Unpublish spec that others depend on
- [ ] Unpublish and republish same version
- [ ] Unpublish without version specified (should fail)

### 5.4 Unpublish - Format Validation

- [ ] Valid format: `username/spec@1.0.0`
- [ ] Invalid: missing username (should fail)
- [ ] Invalid: missing version (should fail)
- [ ] Invalid: wrong separator (should fail)
- [ ] Invalid: extra slashes (should fail)
- [ ] Invalid: spaces in name (should fail)
