# Part 5: Update & Maintenance Commands

## 10. UPDATE COMMAND

### 10.1 Update - Single Spec

- [ ] Install spec: `username/spec@1.0.0`
- [ ] Publish new version: `1.1.0`
- [ ] Run: `spectrl update username/spec`
- [ ] Verify update detected
- [ ] Verify new version installed
- [ ] Verify old version removed or kept
- [ ] Verify lock file updated
- [ ] Verify files updated

### 10.2 Update - All Specs

- [ ] Install multiple specs with updates available
- [ ] Run: `spectrl update --all`
- [ ] Verify all updates detected
- [ ] Verify all specs updated
- [ ] Verify lock file updated
- [ ] Verify summary shown

### 10.3 Update - No Updates Available

- [ ] Install latest versions
- [ ] Run: `spectrl update`
- [ ] Verify message: "All specs up to date"
- [ ] Verify no changes made
- [ ] Verify lock file unchanged

### 10.4 Update - Breaking Changes

- [ ] Install spec 1.0.0
- [ ] Publish breaking change 2.0.0
- [ ] Run update
- [ ] Verify warns about major version
- [ ] Verify requires confirmation or flag
- [ ] Verify can opt out of major updates

### 10.5 Update - With Dependencies

- [ ] Spec A depends on B@1.0.0
- [ ] Install A (installs B 1.0.0)
- [ ] Publish B@1.1.0
- [ ] Update A
- [ ] Verify B also updated
- [ ] Verify dependency constraints respected

### 10.6 Update - Conflict Resolution

- [ ] Install specs with shared dependency
- [ ] Update causes version conflict
- [ ] Verify conflict detected
- [ ] Verify clear error message
- [ ] Verify suggests resolution

### 10.7 Update - Edge Cases

- [ ] Update without internet
- [ ] Update with API down
- [ ] Update with network interruption
- [ ] Update with disk full
- [ ] Update with corrupted lock file
- [ ] Update non-existent spec
- [ ] Update local-only spec (should skip)
- [ ] Update with uncommitted changes
- [ ] Update during another operation

## 11. REGISTRY MAINTENANCE

### 11.1 Registry Integrity

- [ ] Verify registry structure correct
- [ ] Verify all published specs present
- [ ] Verify all versions present
- [ ] Verify hashes match content
- [ ] Verify no orphaned files
- [ ] Verify no corrupted files

### 11.2 Registry Cleanup

- [ ] Manually delete spec from registry
- [ ] Verify install detects and re-downloads
- [ ] Manually corrupt spec file
- [ ] Verify hash validation catches it
- [ ] Verify re-installs clean copy

### 11.3 Lock File Management

- [ ] Verify lock file created on install
- [ ] Verify lock file updated on changes
- [ ] Verify lock file ensures reproducibility
- [ ] Delete lock file, run install
- [ ] Verify recreated correctly
- [ ] Commit lock file to git
- [ ] Clone repo, run install
- [ ] Verify exact same versions installed

### 11.4 Index File Management

- [ ] Manually edit index file
- [ ] Verify validation on next command
- [ ] Add invalid entry
- [ ] Verify rejected with clear error
- [ ] Remove required field
- [ ] Verify error message helpful
