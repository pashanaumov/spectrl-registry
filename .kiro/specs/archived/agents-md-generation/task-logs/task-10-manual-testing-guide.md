# Task 10: Manual Testing and Validation

## Overview

This document provides a comprehensive manual testing guide for the AGENTS.md auto-generation feature. Since this task involves interactive CLI testing with prompts and user input, it requires hands-on validation.

## Test Environment Setup

The CLI has been built and is ready for testing. You can run tests using:

```bash
# From the workspace root
./packages/cli/dist/cli.js init [flags]

# Or if you have it linked globally
spectrl init [flags]
```

## Test Scenarios

### Scenario 1: Fresh Directory - Create New AGENTS.md

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-1 && cd /tmp/test-spectrl-1`
2. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init`
3. Observe the prompt: "Create AGENTS.md to configure AI assistants?"
4. Verify two choices are shown:
   - "Yes (recommended)" (should be highlighted by default)
   - "No"
5. Test arrow key navigation (up/down) to switch between options
6. Select "Yes (recommended)" by pressing Enter

**Expected Results:**

- ✓ Created AGENTS.md message appears
- AGENTS.md file is created in the directory
- File starts with `<!-- Added by Spectrl -->` marker
- File contains the complete template content
- Init completes successfully

**Verification Commands:**

```bash
# Check file exists
ls -la AGENTS.md

# Check marker is first line
head -n 1 AGENTS.md

# Check file encoding
file AGENTS.md  # Should show UTF-8

# Check content matches template
cat AGENTS.md
```

---

### Scenario 2: Fresh Directory - Decline Creation

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-2 && cd /tmp/test-spectrl-2`
2. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init`
3. Navigate to "No" using arrow keys
4. Press Enter to select "No"

**Expected Results:**

- ℹ Skipped AGENTS.md creation message appears
- Message: "AI assistants won't automatically consult specs. You can create AGENTS.md manually later."
- No AGENTS.md file is created
- Init completes successfully with exit code 0

**Verification Commands:**

```bash
# Verify no AGENTS.md exists
ls -la AGENTS.md  # Should show "No such file or directory"

# Check .spectrl was still created
ls -la .spectrl/spectrl-index.json
```

---

### Scenario 3: Fresh Directory - Cancel with Ctrl+C

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-3 && cd /tmp/test-spectrl-3`
2. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init`
3. When prompt appears, press Ctrl+C

**Expected Results:**

- ℹ Skipped AGENTS.md creation message appears
- Implications message about AI assistants appears
- No AGENTS.md file is created
- Init completes successfully (graceful handling)

---

### Scenario 4: Existing Custom AGENTS.md - Append

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-4 && cd /tmp/test-spectrl-4`
2. Create custom AGENTS.md: `echo "# My Custom Instructions\n\nUse TypeScript for everything." > AGENTS.md`
3. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init`
4. Observe prompt: "AGENTS.md found. Append Spectrl instructions to the bottom?"
5. Verify two choices:
   - "Yes (recommended)" (highlighted by default)
   - "No"
6. Test arrow key navigation
7. Select "Yes (recommended)"

**Expected Results:**

- ✓ Added Spectrl instructions to AGENTS.md message appears
- Original content is preserved
- Separator `---` is added
- Spectrl marker and template are appended
- No trailing whitespace before separator

**Verification Commands:**

```bash
# Check original content is preserved
head -n 3 AGENTS.md

# Check separator and marker exist
grep -n "^---$" AGENTS.md
grep -n "<!-- Added by Spectrl -->" AGENTS.md

# View full file
cat AGENTS.md
```

---

### Scenario 5: Existing Custom AGENTS.md - Decline Append

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-5 && cd /tmp/test-spectrl-5`
2. Create custom AGENTS.md: `echo "# My Custom Instructions" > AGENTS.md`
3. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init`
4. Select "No"

**Expected Results:**

- ℹ Skipped AGENTS.md update message appears
- Message: "You can add Spectrl instructions manually if needed"
- Original AGENTS.md is unchanged
- Init completes successfully

**Verification Commands:**

```bash
# Verify file is unchanged
cat AGENTS.md  # Should only show original content
```

---

### Scenario 6: Existing Custom AGENTS.md - Cancel Append

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-6 && cd /tmp/test-spectrl-6`
2. Create custom AGENTS.md: `echo "# My Custom Instructions" > AGENTS.md`
3. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init`
4. Press Ctrl+C when prompted

**Expected Results:**

- ℹ Skipped AGENTS.md update message appears
- Helpful message about manual setup
- Original file unchanged
- Init completes successfully

---

### Scenario 7: Idempotent Behavior - Re-run After Append

**Test Steps:**

1. Use the directory from Scenario 4 (or create new with appended AGENTS.md)
2. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init` again
3. Observe behavior (should NOT prompt)

**Expected Results:**

- ✓ AGENTS.md already contains Spectrl instructions message appears
- No prompt is shown
- File is not modified
- No duplicate content
- Init completes successfully

**Verification Commands:**

```bash
# Count occurrences of marker (should be 1)
grep -c "<!-- Added by Spectrl -->" AGENTS.md

# Verify no duplicate content
cat AGENTS.md
```

---

### Scenario 8: --skip-agents Flag

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-8 && cd /tmp/test-spectrl-8`
2. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init --skip-agents`

**Expected Results:**

- No prompts about AGENTS.md
- No AGENTS.md file created
- No messages about AGENTS.md
- Init completes successfully
- .spectrl directory is created

**Verification Commands:**

```bash
# Verify no AGENTS.md
ls -la AGENTS.md  # Should not exist

# Verify .spectrl was created
ls -la .spectrl/
```

---

### Scenario 9: --force-agents Flag

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-9 && cd /tmp/test-spectrl-9`
2. Create custom AGENTS.md: `echo "# Old Content" > AGENTS.md`
3. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init --force-agents`

**Expected Results:**

- No prompts shown
- ✓ Created AGENTS.md message appears
- Old content is completely replaced
- New file starts with marker
- New file contains template

**Verification Commands:**

```bash
# Verify old content is gone
grep "Old Content" AGENTS.md  # Should find nothing

# Verify new content
head -n 1 AGENTS.md  # Should show marker
```

---

### Scenario 10: Conflicting Flags Error

**Test Steps:**

1. Create a new temporary directory: `mkdir /tmp/test-spectrl-10 && cd /tmp/test-spectrl-10`
2. Run: `node /path/to/spectrl/packages/cli/dist/cli.js init --skip-agents --force-agents`

**Expected Results:**

- Error message: "Cannot use both --skip-agents and --force-agents"
- Exit code 1 (validation error)
- No files created

**Verification Commands:**

```bash
# Check exit code
echo $?  # Should be 1
```

---

### Scenario 11: Template Content Verification

**Test Steps:**

1. Create AGENTS.md using any method from above
2. Compare content with \_\_AGENTS.md template

**Expected Results:**

- Content after marker matches \_\_AGENTS.md exactly
- All sections are present:
  - What is Spectrl?
  - Core Principles
  - Primary Source of Truth
  - Installed Specs
  - How to Use Specs (with 8 subsections)
  - Priority and Conflict Resolution
  - Error Handling
  - Spec Locations
  - Example Workflows
  - Key Reminders

**Verification Commands:**

```bash
# Extract content after marker and compare
tail -n +2 AGENTS.md > /tmp/generated-content.md
diff /tmp/generated-content.md __AGENTS.md
```

---

### Scenario 12: Marker Placement Verification

**Test Steps:**

1. Test both new file creation and append scenarios
2. Verify marker placement

**Expected Results:**

For new files:

- Marker is the first line (line 1)
- Template starts on line 2

For appended files:

- Original content is preserved
- Separator `---` appears after original content
- Marker appears after separator
- Template appears after marker

**Verification Commands:**

```bash
# For new files
sed -n '1p' AGENTS.md  # Should show marker

# For appended files
grep -n "<!-- Added by Spectrl -->" AGENTS.md  # Note line number
```

---

### Scenario 13: File Encoding Verification

**Test Steps:**

1. Create AGENTS.md using any method
2. Check file encoding

**Expected Results:**

- File is UTF-8 encoded
- No BOM (Byte Order Mark)
- Platform-appropriate line endings

**Verification Commands:**

```bash
# Check encoding
file -I AGENTS.md  # Should show charset=utf-8

# Check for BOM
hexdump -C AGENTS.md | head -n 1  # Should NOT start with EF BB BF
```

---

### Scenario 14: Log Messages Verification

**Test Steps:**
Review all scenarios above and verify log messages are:

- Clear and informative
- Use consistent formatting (✓ for success, ℹ for info)
- Include helpful implications messages when declining
- Provide actionable guidance

**Expected Messages:**

Success messages:

- "✓ Created AGENTS.md"
- "✓ Added Spectrl instructions to AGENTS.md"
- "✓ AGENTS.md already contains Spectrl instructions"

Info messages:

- "ℹ Skipped AGENTS.md creation"
- "ℹ Skipped AGENTS.md update"

Implications messages:

- "AI assistants won't automatically consult specs. You can create AGENTS.md manually later."
- "You can add Spectrl instructions manually if needed"

---

## Quick Test Script

Here's a bash script to automate some of the testing:

```bash
#!/bin/bash

SPECTRL_CLI="/path/to/spectrl/packages/cli/dist/cli.js"
TEST_BASE="/tmp/spectrl-tests"

# Clean up previous tests
rm -rf "$TEST_BASE"
mkdir -p "$TEST_BASE"

echo "=== Test 1: Fresh directory with --force-agents ==="
cd "$TEST_BASE" && mkdir test1 && cd test1
node "$SPECTRL_CLI" init --force-agents
echo "Checking AGENTS.md exists..."
[ -f AGENTS.md ] && echo "✓ PASS" || echo "✗ FAIL"
echo "Checking marker is first line..."
[ "$(head -n 1 AGENTS.md)" = "<!-- Added by Spectrl -->" ] && echo "✓ PASS" || echo "✗ FAIL"
echo ""

echo "=== Test 2: --skip-agents flag ==="
cd "$TEST_BASE" && mkdir test2 && cd test2
node "$SPECTRL_CLI" init --skip-agents
echo "Checking AGENTS.md does NOT exist..."
[ ! -f AGENTS.md ] && echo "✓ PASS" || echo "✗ FAIL"
echo "Checking .spectrl was created..."
[ -d .spectrl ] && echo "✓ PASS" || echo "✗ FAIL"
echo ""

echo "=== Test 3: Conflicting flags ==="
cd "$TEST_BASE" && mkdir test3 && cd test3
node "$SPECTRL_CLI" init --skip-agents --force-agents 2>&1 | grep -q "Cannot use both"
[ $? -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL"
echo ""

echo "=== Test 4: Idempotent behavior ==="
cd "$TEST_BASE" && mkdir test4 && cd test4
node "$SPECTRL_CLI" init --force-agents
node "$SPECTRL_CLI" init --force-agents 2>&1 | grep -q "already contains"
[ $? -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL"
echo "Checking no duplicate markers..."
marker_count=$(grep -c "<!-- Added by Spectrl -->" AGENTS.md)
[ "$marker_count" -eq 1 ] && echo "✓ PASS" || echo "✗ FAIL (found $marker_count markers)"
echo ""

echo "=== Test 5: Append to existing file ==="
cd "$TEST_BASE" && mkdir test5 && cd test5
echo "# My Custom Instructions" > AGENTS.md
echo "" >> AGENTS.md
echo "Use TypeScript everywhere." >> AGENTS.md
node "$SPECTRL_CLI" init --force-agents
echo "Checking original content is gone (force overwrite)..."
grep -q "My Custom Instructions" AGENTS.md
[ $? -ne 0 ] && echo "✓ PASS" || echo "✗ FAIL"
echo ""

echo "=== All automated tests complete ==="
echo "Please run interactive tests manually for prompt testing"
```

## Requirements Coverage

This manual testing validates all functional requirements:

- **Requirement 1**: AGENTS.md creation prompt (Scenarios 1, 2, 3)
- **Requirement 2**: Detecting existing AGENTS.md (Scenarios 4, 5, 6, 7)
- **Requirement 3**: Prompting for append (Scenarios 4, 5, 6)
- **Requirement 4**: Appending Spectrl section (Scenario 4)
- **Requirement 5**: Declining creation/append (Scenarios 2, 5)
- **Requirement 6**: Idempotent behavior (Scenario 7)
- **Requirement 7**: Template content (Scenario 11)
- **Requirement 8**: --force-agents flag (Scenario 9)
- **Requirement 9**: --skip-agents flag (Scenario 8, 10)

## Next Steps

1. Run through each scenario manually
2. Document any issues found
3. Verify all expected results match actual behavior
4. Test on different platforms if possible (macOS, Linux, Windows)
5. Mark task as complete once all scenarios pass
