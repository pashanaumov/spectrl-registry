# Part 9: Edge Cases & Error Scenarios

## 22. NETWORK & CONNECTIVITY

### 22.1 Offline Mode

- [ ] Disconnect internet
- [ ] Run: `spectrl init` (should work)
- [ ] Run: `spectrl new test-spec` (should work)
- [ ] Run: `spectrl publish` locally (should work)
- [ ] Run: `spectrl install` from local registry (should work)
- [ ] Run: `spectrl login` (should fail gracefully)
- [ ] Run: `spectrl search` (should fail gracefully)
- [ ] Run: `spectrl install username/spec` (should fail gracefully)
- [ ] Verify all error messages helpful
- [ ] Reconnect internet
- [ ] Verify commands work again

### 22.2 Slow Connection

- [ ] Throttle network to 3G speed
- [ ] Run: `spectrl search api`
- [ ] Verify shows loading indicator
- [ ] Verify eventually completes
- [ ] Install large spec
- [ ] Verify shows progress
- [ ] Verify completes successfully
- [ ] Visit web app
- [ ] Verify loading states shown
- [ ] Verify eventually loads

### 22.3 Connection Interruption

- [ ] Start installing large spec
- [ ] Disconnect internet mid-download
- [ ] Verify error message
- [ ] Reconnect internet
- [ ] Run install again
- [ ] Verify resumes or restarts
- [ ] Verify completes successfully
- [ ] Verify no corrupted files

### 22.4 API Unavailable

- [ ] Simulate API down (block API domain)
- [ ] Run: `spectrl search`
- [ ] Verify error message clear
- [ ] Verify suggests checking connection
- [ ] Visit web app
- [ ] Verify error page shown
- [ ] Verify error is user-friendly
- [ ] Restore API access
- [ ] Verify recovers

### 22.5 Timeout Scenarios

- [ ] Simulate very slow API (>30s response)
- [ ] Run command
- [ ] Verify timeout occurs
- [ ] Verify timeout message clear
- [ ] Verify can retry
- [ ] Test with different timeout values

## 23. FILE SYSTEM ISSUES

### 23.1 Permission Errors

- [ ] Create directory without write permission
- [ ] Try: `spectrl init`
- [ ] Verify permission error caught
- [ ] Verify error message helpful
- [ ] Try: `spectrl publish`
- [ ] Verify fails gracefully
- [ ] Try: `spectrl install`
- [ ] Verify fails gracefully
- [ ] Fix permissions
- [ ] Verify commands work

### 23.2 Disk Space Issues

- [ ] Fill disk to near capacity
- [ ] Try: `spectrl publish`
- [ ] Verify disk space error caught
- [ ] Verify error message clear
- [ ] Try: `spectrl install` large spec
- [ ] Verify fails before corruption
- [ ] Free up space
- [ ] Verify commands work

### 23.3 Read-Only Filesystem

- [ ] Mount directory as read-only
- [ ] Try: `spectrl init`
- [ ] Verify fails with clear error
- [ ] Try: `spectrl publish`
- [ ] Verify fails gracefully
- [ ] Remount as read-write
- [ ] Verify commands work

### 23.4 Corrupted Files

- [ ] Install spec successfully
- [ ] Manually corrupt installed file
- [ ] Run: `spectrl install` again
- [ ] Verify detects corruption
- [ ] Verify re-installs clean copy
- [ ] Corrupt registry file
- [ ] Run command
- [ ] Verify detects and handles
- [ ] Verify can recover

### 23.5 Missing Files

- [ ] Install spec
- [ ] Manually delete installed file
- [ ] Run command that uses spec
- [ ] Verify detects missing file
- [ ] Verify re-installs if needed
- [ ] Delete registry directory
- [ ] Run install
- [ ] Verify recreates registry

### 23.6 Symlink Issues

- [ ] Create broken symlink
- [ ] Run: `spectrl install`
- [ ] Verify handles broken symlink
- [ ] On Windows, test junction points
- [ ] Verify fallback to copy works
- [ ] Test symlink to symlink
- [ ] Verify resolves correctly

## 24. DATA VALIDATION & CORRUPTION

### 24.1 Invalid JSON Files

- [ ] Create spectrl.json with invalid JSON
- [ ] Run: `spectrl publish`
- [ ] Verify JSON parse error caught
- [ ] Verify error shows line number
- [ ] Verify error message helpful
- [ ] Fix JSON
- [ ] Verify works

### 24.2 Schema Validation

- [ ] Create spectrl.json missing required field
- [ ] Run: `spectrl publish`
- [ ] Verify validation error
- [ ] Verify lists missing field
- [ ] Add invalid field type
- [ ] Verify type error caught
- [ ] Add extra unknown fields
- [ ] Verify handled appropriately

### 24.3 Version Format Validation

- [ ] Use invalid version: "1.0"
- [ ] Verify rejected
- [ ] Use invalid version: "v1.0.0"
- [ ] Verify rejected or normalized
- [ ] Use invalid version: "1.0.0-beta"
- [ ] Verify handled correctly
- [ ] Use invalid version: "abc"
- [ ] Verify rejected with clear error

### 24.4 Hash Validation

- [ ] Publish spec with hash
- [ ] Manually change hash in manifest
- [ ] Try install
- [ ] Verify hash mismatch detected
- [ ] Verify refuses to install
- [ ] Verify error message clear
- [ ] Restore correct hash
- [ ] Verify installs

### 24.5 Lock File Corruption

- [ ] Create valid lock file
- [ ] Manually corrupt lock file
- [ ] Run: `spectrl install`
- [ ] Verify detects corruption
- [ ] Verify recreates lock file
- [ ] Or verify fails with clear error
- [ ] Delete lock file
- [ ] Run install
- [ ] Verify recreates correctly

## 25. CONCURRENT OPERATIONS

### 25.1 Multiple CLI Instances

- [ ] Open two terminals
- [ ] Run: `spectrl publish` in both simultaneously
- [ ] Verify handles correctly
- [ ] Verify no corruption
- [ ] Run: `spectrl install` in both
- [ ] Verify both complete successfully
- [ ] Verify registry consistent

### 25.2 File Locking

- [ ] Start long-running operation
- [ ] Start another operation on same spec
- [ ] Verify second waits or fails gracefully
- [ ] Verify no corruption
- [ ] Verify clear error if conflict

### 25.3 Race Conditions

- [ ] Install spec A
- [ ] While installing, delete registry
- [ ] Verify handles gracefully
- [ ] Publish spec
- [ ] While publishing, kill process
- [ ] Verify can recover
- [ ] Verify no partial state

## 26. SECURITY & MALICIOUS INPUT

### 26.1 Path Traversal

- [ ] Create spec with file: "../../../etc/passwd"
- [ ] Try publish
- [ ] Verify rejected
- [ ] Try install spec with malicious paths
- [ ] Verify sanitized or rejected

### 26.2 Command Injection

- [ ] Create spec name with shell commands
- [ ] Try publish
- [ ] Verify sanitized
- [ ] Try install with malicious spec name
- [ ] Verify no command execution

### 26.3 XSS Attempts (Web)

- [ ] Publish spec with XSS in description
- [ ] View on web
- [ ] Verify escaped/sanitized
- [ ] Try XSS in spec name
- [ ] Verify escaped
- [ ] Try XSS in file content
- [ ] Verify rendered safely

### 26.4 SQL Injection (API)

- [ ] Search with SQL injection attempt
- [ ] Verify sanitized
- [ ] Verify no database error
- [ ] Try in spec name
- [ ] Verify handled safely

### 26.5 Large Payloads

- [ ] Create spec with very large file (>100MB)
- [ ] Try publish
- [ ] Verify size limit enforced
- [ ] Or verify handles gracefully
- [ ] Create spec with many files (>10,000)
- [ ] Try publish
- [ ] Verify limit or handles

### 26.6 Malformed Requests

- [ ] Send malformed API request
- [ ] Verify 400 error returned
- [ ] Verify error message safe
- [ ] Send request with invalid auth
- [ ] Verify 401 error
- [ ] Send oversized request
- [ ] Verify rejected
