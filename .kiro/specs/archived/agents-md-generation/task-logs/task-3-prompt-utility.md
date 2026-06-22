# Task 3: Add Prompt Utility to Utils Module

## What Was Implemented

Added the `promptYesNo()` function to `packages/cli/src/utils.ts` using the lightweight `prompts` library. The function provides an interactive yes/no selection with arrow key navigation, significantly improving the user experience compared to text-based input.

### Core Implementation

- **Function signature**: `promptYesNo(message, defaultYes = true): Promise<boolean | undefined>`
- **Prompt type**: 'select' with two choices ("Yes" and "No")
- **Navigation**: Arrow keys (up/down) to switch between options
- **Selection**: Enter key to confirm choice
- **Cancellation**: Ctrl+C returns `undefined`
- **Default handling**: Initial selection set to index 0 (Yes) or 1 (No) based on parameter

## Why These Decisions

### Using the Prompts Library

The `prompts` library was chosen over the built-in `readline` module for several reasons:

- **Better UX**: Visual selection with arrow keys is more intuitive than typing y/n
- **Lightweight**: Small bundle size aligns with project's minimal dependency philosophy
- **Robust handling**: Automatically handles edge cases like Ctrl+C, invalid input
- **Modern CLI feel**: Matches the UX of popular CLI tools like inquirer

### Return Type: boolean | undefined

The function returns `undefined` when the user cancels (Ctrl+C) rather than throwing an error. This design allows calling code to gracefully handle cancellation as a distinct case from "No". The init command can treat cancellation the same as declining, but the distinction is available if needed.

### Default Parameter Value

Setting `defaultYes = true` as the default parameter value follows the common pattern where "Yes" is the expected/safe choice for most prompts. The initial selection (index 0 or 1) is calculated from this boolean, making the API simple and intuitive.

### Placement in utils.ts

The function was added to `utils.ts` alongside other utility functions like file operations and output helpers. This keeps all shared utilities in one place and follows the existing code organization pattern.

## Requirements Addressed

This implementation addresses the following requirements:

- **Requirement 3.1**: Prompts user when existing AGENTS.md is detected
- **Requirement 3.2**: Displays clear prompt message
- **Requirement 3.3**: Shows two choices ("Yes" and "No")
- **Requirement 3.4**: Allows arrow key navigation
- **Requirement 3.5**: Defaults to "Yes" as initially selected choice
- **Requirement 3.6**: Allows selection via Enter key
- **Requirement 3.7**: Displays before file modifications
- **Requirement 3.8**: Uses `prompts` library for interactive selection

## Code Changes

### Modified File: `packages/cli/src/utils.ts`

Added:

- Import statement: `import prompts from 'prompts'`
- `promptYesNo()` function with full JSDoc documentation

The function is exported and ready to be used by the init command in the next task.

## Challenges & Considerations

### ESM Import Syntax

Used default import syntax (`import prompts from 'prompts'`) which is the correct ESM syntax for the prompts library. This works seamlessly with the project's TypeScript configuration targeting ESNext modules.

### Type Inference

Removed explicit type annotation from the `defaultYes` parameter (`defaultYes = true` instead of `defaultYes: boolean = true`) to satisfy the linter rule about trivially inferred types. TypeScript correctly infers the type as `boolean` from the default value.

### Response Value Access

The prompts library returns an object with properties matching the prompt names. Since we named our prompt 'value', we access `response.value` to get the user's selection. If the user cancels, the response object is empty and `response.value` is `undefined`.

### Integration with Spinner

The function is designed to work with the ora spinner used in the init command. The calling code will need to stop the spinner before calling `promptYesNo()` and restart it afterward to prevent UI conflicts.

## Testing Considerations

The function is designed for easy testing:

- Use `prompts.inject()` to programmatically provide answers in tests
- Can inject `true`, `false`, or `undefined` to simulate different user actions
- No need to mock stdin/stdout - prompts library handles test mode
- Pure function with predictable behavior

Future tests (Task 8) will cover:

- Selecting "Yes" returns true
- Selecting "No" returns false
- Cancellation returns undefined
- Default value sets correct initial selection
