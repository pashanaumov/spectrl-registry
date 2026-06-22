# Part 10: CLI Output & User Experience

## 27. CLI OUTPUT FORMATTING

### 27.1 Colored Output

- [ ] Run: `spectrl --help`
- [ ] Verify command names highlighted/colored
- [ ] Verify descriptions readable
- [ ] Run: `spectrl publish`
- [ ] Verify success messages in green/positive color
- [ ] Run command that fails
- [ ] Verify error messages in red/negative color
- [ ] Verify warnings in yellow/orange (if any)
- [ ] Test with NO_COLOR environment variable set
- [ ] Verify colors disabled when NO_COLOR=1
- [ ] Test output piped to file: `spectrl list > output.txt`
- [ ] Verify no ANSI codes in piped output

### 27.2 Progress Indicators

- [ ] Install large spec
- [ ] Verify progress indicator shown (spinner, progress bar, or percentage)
- [ ] Verify progress updates during download
- [ ] Verify progress clears when complete
- [ ] Publish large spec
- [ ] Verify progress shown during upload
- [ ] Run: `spectrl search api`
- [ ] Verify loading indicator while searching
- [ ] Interrupt operation (Ctrl+C)
- [ ] Verify progress indicator cleans up properly

### 27.3 Table Formatting

- [ ] Run: `spectrl list`
- [ ] Verify output formatted as table or list
- [ ] Verify columns aligned
- [ ] Verify readable with many specs
- [ ] Verify handles long spec names
- [ ] Verify handles long descriptions
- [ ] Run: `spectrl search api`
- [ ] Verify results formatted clearly
- [ ] Verify metadata aligned
- [ ] Test in narrow terminal (80 chars)
- [ ] Verify wraps or truncates appropriately
- [ ] Test in wide terminal (200+ chars)
- [ ] Verify uses space well

### 27.4 Error Message Quality

- [ ] Trigger validation error (invalid spectrl.json)
- [ ] Verify error message clear and actionable
- [ ] Verify shows what's wrong
- [ ] Verify suggests how to fix
- [ ] Verify shows file location if relevant
- [ ] Trigger network error (disconnect internet)
- [ ] Verify error message helpful
- [ ] Verify suggests checking connection
- [ ] Trigger auth error (not logged in)
- [ ] Verify suggests running `spectrl login`
- [ ] Trigger missing file error
- [ ] Verify shows which file is missing
- [ ] Trigger version conflict
- [ ] Verify explains conflict clearly
- [ ] Verify suggests resolution

### 27.5 Success Messages

- [ ] Run: `spectrl publish`
- [ ] Verify success message clear
- [ ] Verify shows what was published
- [ ] Verify shows version
- [ ] Verify shows next steps (optional)
- [ ] Run: `spectrl install username/spec`
- [ ] Verify success message
- [ ] Verify shows what was installed
- [ ] Verify shows where it was installed
- [ ] Run: `spectrl login`
- [ ] Verify success message welcoming
- [ ] Verify shows username

### 27.6 Interactive Prompts (if any)

- [ ] Run command requiring confirmation
- [ ] Verify prompt clear
- [ ] Verify default option indicated
- [ ] Press Enter (accept default)
- [ ] Verify default chosen
- [ ] Run again, type explicit answer
- [ ] Verify answer respected
- [ ] Test with invalid input
- [ ] Verify re-prompts or shows error
- [ ] Test Ctrl+C during prompt
- [ ] Verify cancels gracefully

### 27.7 Verbose/Debug Output

- [ ] Run with verbose flag (if exists): `spectrl --verbose publish`
- [ ] Verify shows detailed output
- [ ] Verify shows internal steps
- [ ] Verify helps with debugging
- [ ] Run with debug flag (if exists): `spectrl --debug install`
- [ ] Verify shows even more detail
- [ ] Verify shows API requests/responses
- [ ] Verify shows file operations

### 27.8 Quiet Mode (if supported)

- [ ] Run with quiet flag: `spectrl --quiet publish`
- [ ] Verify minimal output
- [ ] Verify only errors shown
- [ ] Verify suitable for scripts
- [ ] Test in CI environment
- [ ] Verify output CI-friendly

### 27.9 JSON Output (if supported)

- [ ] Run with JSON flag: `spectrl list --json`
- [ ] Verify output is valid JSON
- [ ] Verify parseable by jq
- [ ] Verify includes all relevant data
- [ ] Run: `spectrl search api --json`
- [ ] Verify results in JSON format
- [ ] Verify suitable for programmatic use

### 27.10 Terminal Width Handling

- [ ] Resize terminal to 40 chars wide
- [ ] Run: `spectrl list`
- [ ] Verify output adapts
- [ ] Verify no broken formatting
- [ ] Resize to 200 chars wide
- [ ] Run: `spectrl list`
- [ ] Verify uses space efficiently
- [ ] Test with COLUMNS environment variable
- [ ] Verify respects COLUMNS setting

### 27.11 Unicode & Emoji Support

- [ ] Verify emoji in output (✓, ✗, ⚠, etc.)
- [ ] Verify renders correctly in terminal
- [ ] Create spec with unicode in name/description
- [ ] Verify displays correctly
- [ ] Verify doesn't break formatting
- [ ] Test in terminal without unicode support
- [ ] Verify falls back gracefully

### 27.12 Exit Codes

- [ ] Run successful command
- [ ] Verify exit code 0: `echo $?`
- [ ] Run command that fails (validation error)
- [ ] Verify non-zero exit code
- [ ] Run command that fails (network error)
- [ ] Verify non-zero exit code
- [ ] Run command that fails (auth error)
- [ ] Verify non-zero exit code
- [ ] Verify different error types have different codes (if implemented)
- [ ] Test in shell script
- [ ] Verify exit codes work with `&&` and `||`
