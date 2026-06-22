# Spectrl Manual Testing Checklist

**Version:** 1.0  
**Last Updated:** Pre-launch validation  
**Purpose:** Comprehensive manual testing before public launch

## How to Use This Checklist

- Test each scenario in the order presented
- Mark items: ✅ (pass), ❌ (fail), ⚠️ (partial/needs investigation), ⏭️ (skipped)
- Document any issues with: scenario number, steps to reproduce, expected vs actual
- Test on multiple environments where indicated
- Use fresh test accounts to simulate real user experience
- Take screenshots of any UI issues
- Note performance issues (slow loading, timeouts, etc.)

---

# PART 1: CLI INSTALLATION & SETUP

## 1.1 Fresh Installation - macOS

**Prerequisites:** Clean macOS system without Spectrl installed

- [ ] 1.1.1 Install globally via npm: `npm install -g @spectrl/cli`
- [ ] 1.1.2 Verify installation: `spectrl --version` displays version
- [ ] 1.1.3 Verify command in PATH: `which spectrl` shows path
- [ ] 1.1.4 Run help: `spectrl --help` shows all commands
- [ ] 1.1.5 Run help for each command: `spectrl <cmd> --help`
- [ ] 1.1.6 Verify npx usage: `npx @spectrl/cli@latest --version`
- [ ] 1.1.7 Test with pnpm: `pnpm add -g @spectrl/cli`
- [ ] 1.1.8 Test with yarn: `yarn global add @spectrl/cli`
- [ ] 1.1.9 Verify error when command not found (before install)

## 1.2 Fresh Installation - Linux

**Prerequisites:** Clean Linux system

- [ ] 1.2.1 Install via npm on Ubuntu/Debian
- [ ] 1.2.2 Install via npm on Fedora/RHEL
- [ ] 1.2.3 Install via npm on Arch Linux
- [ ] 1.2.4 Verify PATH configuration
- [ ] 1.2.5 Test with bash shell
- [ ] 1.2.6 Test with zsh shell
- [ ] 1.2.7 Test with fish shell
- [ ] 1.2.8 Verify permissions are correct
- [ ] 1.2.9 Test npx usage without install
