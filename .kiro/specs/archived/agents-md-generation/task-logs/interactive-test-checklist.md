# Interactive Prompt Testing Checklist

## Setup

Run these commands from the spectrl workspace root.

## Test 1: Fresh Directory - Prompt for Creation

```bash
rm -rf /tmp/interactive-test-1 && mkdir /tmp/interactive-test-1
cd /tmp/interactive-test-1
node ~/Desktop/dev/spectrl/packages/cli/dist/cli.js init
```

**Expected Prompt:**

```
? Create AGENTS.md to configure AI assistants?
❯ Yes (recommended)
  No
```

**Actions to test:**

- [ ] Verify "Yes (recommended)" is highlighted by default (has ❯ arrow)
- [ ] Press ↓ arrow key - verify "No" becomes highlighted
- [ ] Press ↑ arrow key - verify "Yes (recommended)" becomes highlighted again
- [ ] Press Enter to select "Yes (recommended)"

**Expected Result:**

- [ ] Message: "✓ Created AGENTS.md"
- [ ] AGENTS.md file exists
- [ ] Init completes successfully

---

## Test 2: Fresh Directory - Decline Creation

```bash
rm -rf /tmp/interactive-test-2 && mkdir /tmp/interactive-test-2
cd /tmp/interactive-test-2
node ~/Desktop/dev/spectrl/packages/cli/dist/cli.js init
```

**Actions to test:**

- [ ] Press ↓ arrow key to select "No"
- [ ] Press Enter

**Expected Result:**

- [ ] Message: "ℹ Skipped AGENTS.md creation"
- [ ] Message: "AI assistants won't automatically consult specs. You can create AGENTS.md manually later."
- [ ] No AGENTS.md file created
- [ ] Init completes successfully

---

## Test 3: Fresh Directory - Cancel with Ctrl+C

```bash
rm -rf /tmp/interactive-test-3 && mkdir /tmp/interactive-test-3
cd /tmp/interactive-test-3
node ~/Desktop/dev/spectrl/packages/cli/dist/cli.js init
```

**Actions to test:**

- [ ] Press Ctrl+C when prompt appears

**Expected Result:**

- [ ] Message: "ℹ Skipped AGENTS.md creation"
- [ ] Message: "AI assistants won't automatically consult specs. You can create AGENTS.md manually later."
- [ ] No AGENTS.md file created
- [ ] Init completes successfully (graceful handling)

---

## Test 4: Existing Custom AGENTS.md - Prompt to Append

```bash
rm -rf /tmp/interactive-test-4 && mkdir /tmp/interactive-test-4
cd /tmp/interactive-test-4
echo "# My Custom Instructions" > AGENTS.md
echo "" >> AGENTS.md
echo "Always use TypeScript." >> AGENTS.md
node ~/Desktop/dev/spectrl/packages/cli/dist/cli.js init
```

**Expected Prompt:**

```
? AGENTS.md found. Append Spectrl instructions to the bottom?
❯ Yes (recommended)
  No
```

**Actions to test:**

- [ ] Verify "Yes (recommended)" is highlighted by default
- [ ] Press ↓ arrow key - verify "No" becomes highlighted
- [ ] Press ↑ arrow key - verify "Yes (recommended)" becomes highlighted again
- [ ] Press Enter to select "Yes (recommended)"

**Expected Result:**

- [ ] Message: "✓ Added Spectrl instructions to AGENTS.md"
- [ ] Original content preserved at top
- [ ] Separator "---" added
- [ ] Spectrl content appended at bottom
- [ ] Init completes successfully

**Verify file content:**

```bash
cat AGENTS.md
# Should show:
# My Custom Instructions
#
# Always use TypeScript.
#
# ---
#
# <!-- Added by Spectrl -->
# [rest of template]
```

---

## Test 5: Existing Custom AGENTS.md - Decline Append

```bash
rm -rf /tmp/interactive-test-5 && mkdir /tmp/interactive-test-5
cd /tmp/interactive-test-5
echo "# My Custom Instructions" > AGENTS.md
node ~/Desktop/dev/spectrl/packages/cli/dist/cli.js init
```

**Actions to test:**

- [ ] Press ↓ arrow key to select "No"
- [ ] Press Enter

**Expected Result:**

- [ ] Message: "ℹ Skipped AGENTS.md update"
- [ ] Message: "You can add Spectrl instructions manually if needed"
- [ ] Original AGENTS.md unchanged
- [ ] Init completes successfully

---

## Test 6: Existing Custom AGENTS.md - Cancel Append

```bash
rm -rf /tmp/interactive-test-6 && mkdir /tmp/interactive-test-6
cd /tmp/interactive-test-6
echo "# My Custom Instructions" > AGENTS.md
node ~/Desktop/dev/spectrl/packages/cli/dist/cli.js init
```

**Actions to test:**

- [ ] Press Ctrl+C when prompt appears

**Expected Result:**

- [ ] Message: "ℹ Skipped AGENTS.md update"
- [ ] Message: "You can add Spectrl instructions manually if needed"
- [ ] Original AGENTS.md unchanged
- [ ] Init completes successfully

---

## Test 7: Verify Prompt UI Quality

During any of the above tests, verify:

- [ ] Prompt text is clear and easy to read
- [ ] Arrow keys work smoothly for navigation
- [ ] Selected option is clearly highlighted with ❯ symbol
- [ ] "(recommended)" label is visible and clear
- [ ] Enter key confirms selection immediately
- [ ] Ctrl+C is handled gracefully (no stack trace)

---

## Results Summary

After completing all tests, fill in:

**Passing Tests:** \_\_\_/7

**Issues Found:**

-
-
- **Notes:**

-
-
