# Part 1: CLI Installation, Authentication & Core Commands

## 1. INSTALLATION & SETUP

### 1.1 Fresh Installation - macOS

- [ ] Install via npm: `npm install -g @spectrl/cli`
- [ ] Install via pnpm: `pnpm add -g @spectrl/cli`
- [ ] Install via yarn: `yarn global add @spectrl/cli`
- [ ] Verify: `spectrl --version` shows version
- [ ] Verify: `which spectrl` shows path
- [ ] Test npx: `npx @spectrl/cli@latest --version`
- [ ] Help: `spectrl --help` shows all commands
- [ ] Help per command: `spectrl init --help`, etc.

### 1.2 Fresh Installation - Linux (Ubuntu, Fedora, Arch)

- [ ] Install on Ubuntu/Debian
- [ ] Install on Fedora/RHEL
- [ ] Install on Arch Linux
- [ ] Test with bash shell
- [ ] Test with zsh shell
- [ ] Test with fish shell
- [ ] Verify PATH configuration
- [ ] Verify file permissions

### 1.3 Fresh Installation - Windows

- [ ] Install on Windows 10
- [ ] Install on Windows 11
- [ ] Test in PowerShell
- [ ] Test in Command Prompt
- [ ] Test in Git Bash
- [ ] Test in Windows Terminal
- [ ] Verify PATH in System Environment Variables
- [ ] Test npx usage

### 1.4 Installation Edge Cases

- [ ] Install without internet (should fail gracefully)
- [ ] Install with slow/unstable connection
- [ ] Install with npm registry timeout
- [ ] Install with insufficient disk space
- [ ] Install without Node.js (should show clear error)
- [ ] Install with old Node.js version
- [ ] Install without admin/sudo (should work or fail clearly)
- [ ] Install in path with spaces
- [ ] Install in path with special characters

### 1.5 Update Existing Installation

- [ ] Check current version: `spectrl --version`
- [ ] Update: `npm update -g @spectrl/cli`
- [ ] Verify new version shown
- [ ] Verify existing registry data intact
- [ ] Verify existing auth token works
- [ ] Verify installed specs still work
- [ ] Test downgrade to older version
- [ ] Verify config migration

### 1.6 Uninstallation

- [ ] Uninstall: `npm uninstall -g @spectrl/cli`
- [ ] Verify command no longer available
- [ ] Verify `.spectrl/` data preserved
- [ ] Verify auth token preserved
- [ ] Reinstall and verify data accessible
- [ ] Clean uninstall with data removal

## 2. AUTHENTICATION

### 2.1 First-Time Login (Happy Path)

- [ ] Run: `spectrl login`
- [ ] Verify device code displayed
- [ ] Verify GitHub URL displayed
- [ ] Verify instructions are clear
- [ ] Open URL in browser
- [ ] Enter device code
- [ ] Authorize application
- [ ] Verify success message in CLI
- [ ] Verify token stored
- [ ] Run: `spectrl whoami` shows username

### 2.2 Login Edge Cases

- [ ] Login when already logged in (should show message)
- [ ] Login with expired device code
- [ ] Login and deny authorization
- [ ] Login and close browser before authorizing
- [ ] Login with network interruption
- [ ] Login with GitHub down/unavailable
- [ ] Login and wait for timeout
- [ ] Login with invalid device code manually entered

### 2.3 Whoami Command

- [ ] Run when logged in: shows username
- [ ] Run when not logged in: shows clear error
- [ ] Run with expired token: shows clear error
- [ ] Run with invalid token: shows clear error
- [ ] Run with network down: shows clear error

### 2.4 Logout Command

- [ ] Run: `spectrl logout`
- [ ] Verify success message
- [ ] Verify token removed
- [ ] Run: `spectrl whoami` shows not logged in
- [ ] Logout when not logged in (should handle gracefully)
- [ ] Logout and verify can login again

### 2.5 Token Management

- [ ] Token persists across CLI restarts
- [ ] Token persists across system restarts
- [ ] Token works after CLI update
- [ ] Token location: verify stored securely
- [ ] Multiple users on same machine (separate tokens)
- [ ] Token expiration handling
- [ ] Token refresh (if implemented)

## 3. SPEC CREATION (INIT & NEW)

### 3.1 Init Command - Empty Directory

- [ ] Create empty dir, cd into it
- [ ] Run: `spectrl init`
- [ ] Verify `spectrl-index.json` created
- [ ] Verify file has correct structure
- [ ] Verify `AGENTS.md` created
- [ ] Verify AGENTS.md has template content
- [ ] Run init again (should handle existing file)

### 3.2 Init Command - Existing Project

- [ ] Run in project with files
- [ ] Verify doesn't overwrite existing files
- [ ] Verify integrates with existing structure
- [ ] Run with `--skip-agents` flag
- [ ] Verify AGENTS.md not created
- [ ] Run with `--force-agents` flag
- [ ] Verify AGENTS.md overwritten

### 3.3 Init Command - Edge Cases

- [ ] Run without write permissions
- [ ] Run in read-only filesystem
- [ ] Run in directory with existing spectrl-index.json
- [ ] Run in git repo vs non-git repo
- [ ] Run in nested directory
- [ ] Run with disk full
- [ ] Run with special characters in path

### 3.4 New Command - Happy Path

- [ ] Run: `spectrl new my-spec`
- [ ] Verify directory created
- [ ] Verify `spectrl.json` created
- [ ] Verify default version 0.1.0
- [ ] Verify README.md created
- [ ] Run with version: `spectrl new my-spec --version 1.0.0`
- [ ] Run with description: `spectrl new my-spec --description "Test"`
- [ ] Verify all fields in manifest

### 3.5 New Command - Name Validation

- [ ] Valid name: lowercase-with-hyphens
- [ ] Invalid: UpperCase (should reject)
- [ ] Invalid: spaces in name (should reject)
- [ ] Invalid: special chars !@#$ (should reject)
- [ ] Invalid: starting with hyphen (should reject)
- [ ] Invalid: ending with hyphen (should reject)
- [ ] Invalid: empty name (should reject)
- [ ] Invalid: reserved names if any

### 3.6 New Command - Edge Cases

- [ ] Create in existing directory (should fail)
- [ ] Create without write permissions
- [ ] Create with very long name
- [ ] Create with unicode characters
- [ ] Create in path with spaces
- [ ] Create with disk full
- [ ] Create and immediately publish
