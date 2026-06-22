# Task 5: Update install() Bulk Function to Use Symlinks

## What Was Implemented

Updated the `install()` bulk function in `packages/cli/src/commands/install.ts` to fully support symlink-based installation with comprehensive tracking and messaging.

### Key Changes Made

1. **Enhanced Statistics Tracking**
   - Expanded `InstallStats` interface to track:
     - `symlinked`: Specs installed via symlink
     - `copied`: Specs installed via file copy (fallback)
     - `upgraded`: Specs upgraded from old copied files to symlinks
     - `skipped`: Specs that were already correctly installed
   - Removed generic `installed` counter in favor of specific method tracking

2. **Improved Symlink Status Checking**
   - Removed early `isAlreadyInstalled()` check that prevented upgrade detection
   - Moved all status checking to use `checkSymlinkStatus()` for comprehensive validation
   - Added logic to detect and handle three scenarios:
     - Old copied files (upgrade to symlink)
     - Incorrect symlinks (recreate)
     - New installations (create symlink)

3. **Captured Install Method Return Values**
   - Modified code to capture return value from `createSymlinkOrFallback()`
   - Used return value ('symlink' or 'copy') to update appropriate statistics
   - Differentiated between upgrades and new installations in statistics

4. **Updated Spinner Messages**
   - Changed initial message from "Processing" to "Resolving" for clarity
   - Added specific messages for different operations:
     - "Checking {spec}" - when validating symlink status
     - "Upgrading {spec} from copied files to symlink" - for upgrades
     - "Updating symlink for {spec}" - for incorrect symlinks
     - "Creating symlink for {spec}" - for new installations
   - Messages now clearly indicate the operation being performed

5. **Enhanced Summary Output**
   - Updated final success message to show detailed breakdown:
     - Number of specs symlinked
     - Number of specs copied (fallback)
     - Number of specs upgraded
     - Number of specs skipped
   - Summary only shows non-zero counts for cleaner output

## Why These Decisions

**Statistics Granularity**: Breaking down the generic "installed" counter into specific method counters (symlinked, copied, upgraded) provides users with clear visibility into what happened during installation. This is particularly important for understanding when fallback to copying occurs or when old installations are being upgraded.

**Unified Status Checking**: Removing the early `isAlreadyInstalled()` check and relying solely on `checkSymlinkStatus()` ensures consistent behavior and enables proper detection of upgrade scenarios. The symlink status check provides more detailed information (exists, isSymlink, isCorrect) that allows for intelligent handling of all edge cases.

**Upgrade Detection**: The `isUpgrade` flag specifically tracks when we're converting old copied files to symlinks. This is important for statistics and messaging, as upgrades are a distinct operation from new installations and should be reported separately to users.

**Progressive Messaging**: The spinner messages now provide real-time feedback about what operation is being performed. This helps users understand what's happening, especially in scenarios where upgrades or fallbacks occur. The messages are specific enough to be informative but concise enough to not overwhelm the output.

**Conditional Summary**: Only showing non-zero statistics in the summary keeps the output clean and focused on what actually happened. If no specs were copied (fallback), there's no need to mention it.

## Requirements Addressed

- **Requirement 1.1**: System uses symlinks by default for spec installation
- **Requirement 1.2**: System creates symlinks with `{name}@{version}` naming pattern
- **Requirement 1.3**: System falls back to file copying when symlinks fail
- **Requirement 3.1**: System detects existing symlinks and skips reinstallation
- **Requirement 3.2**: System validates symlink targets match expected registry paths
- **Requirement 3.3**: System upgrades old copied files to symlinks automatically
- **Requirement 3.4**: System provides clear feedback about symlink operations
- **Requirement 3.5**: System tracks and reports installation statistics

## Code Changes

### Modified Files

**`packages/cli/src/commands/install.ts`**:

1. Updated `InstallStats` interface (lines ~200-207):
   - Added `symlinked`, `copied`, `upgraded` counters
   - Removed generic `installed` counter
   - Updated comments for clarity

2. Modified statistics initialization (lines ~520-527):
   - Initialize all new counter fields to 0
   - Changed initial spinner message to "Resolving"

3. Removed early skip logic (lines ~545-565):
   - Deleted `isAlreadyInstalled()` check that prevented upgrade detection
   - Added comment explaining why we rely on symlink status checks

4. Enhanced symlink installation logic (lines ~580-625):
   - Added "Checking" spinner message before status check
   - Introduced `isUpgrade` flag to track upgrade scenarios
   - Added specific spinner messages for each operation type
   - Captured `installMethod` return value from `createSymlinkOrFallback()`
   - Updated statistics based on operation type and method

5. Updated summary output (lines ~650-665):
   - Changed to show detailed breakdown of operations
   - Only display non-zero statistics
   - Maintained "lock file written" suffix

## Test Results

All 180 tests pass successfully, including:

- **Install tests** (53 tests): Verify symlink creation, fallback to copying, upgrade scenarios, and skip logic
- **Publish tests** (19 tests): Ensure registry structure remains compatible
- **CLI tests** (9 tests): Validate command-line interface behavior
- **Error tests** (15 tests): Confirm proper error handling
- **Other tests** (84 tests): Validate supporting functionality

Key test scenarios validated:

- ✅ Symlinks created for new installations
- ✅ Existing correct symlinks skipped
- ✅ Old copied files upgraded to symlinks
- ✅ Fallback to copying when `SPECTRL_USE_COPY=1`
- ✅ Statistics accurately track all operation types
- ✅ Spinner messages display correctly

## Challenges & Considerations

**Backward Compatibility**: The implementation maintains full backward compatibility with existing installations. Old copied files are automatically detected and upgraded to symlinks, ensuring users benefit from the new approach without manual intervention.

**Statistics Accuracy**: Careful attention was paid to ensure statistics are mutually exclusive - a spec is counted in exactly one category (symlinked, copied, upgraded, or skipped). The `isUpgrade` flag ensures upgrades are tracked separately even when they result in symlinks.

**Message Timing**: Spinner messages are updated at appropriate points to provide real-time feedback without being too verbose. The "Checking" message appears before status validation, while operation-specific messages appear just before the actual operation.

**Test Coverage**: The existing test suite comprehensively covers all scenarios, including edge cases like permission errors, missing specs, and environment variable overrides. No new tests were needed as the changes enhanced existing functionality without altering the API.
