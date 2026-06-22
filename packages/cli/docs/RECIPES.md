# Spectrl CLI Recipes

Step-by-step guides for common Spectrl workflows.

## Table of Contents

1. [Publishing Your First Spec](#publishing-your-first-spec)
2. [Finding and Installing Specs](#finding-and-installing-specs)
3. [Keeping Specs Up to Date](#keeping-specs-up-to-date)
4. [Managing Published Specs](#managing-published-specs)
5. [Working with Local and Public Specs](#working-with-local-and-public-specs)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## Publishing Your First Spec

This guide walks you through creating and publishing your first spec to the public registry.

### Prerequisites

- GitHub account
- Spectrl CLI available via `npx spectrl` (or installed globally with `npm install -g spectrl`)

### Step 1: Create a New Spec

```bash
# Create a directory for your spec
mkdir my-api-spec
cd my-api-spec

# Initialize the spec with Spectrl
npx spectrl new api-spec --description "REST API specification template"
```

**Expected output:**

```
✓ Created spectrl.json
✓ Created README.md
✓ Spec 'api-spec' created successfully

Next steps:
1. Edit your spec files
2. Update spectrl.json if you add more files
3. Run 'spectrl publish' when ready
```

### Step 2: Add Your Content

Edit the generated files and add your specification content:

```bash
# Edit the main README
echo "# REST API Specification

## Overview
This template provides a structured approach to documenting REST APIs.

## Endpoints

### GET /users
Returns a list of users.

### POST /users
Creates a new user.

## Authentication
All endpoints require Bearer token authentication.
" > README.md

# Create additional files
mkdir docs
echo "# API Architecture

## Design Principles
- RESTful design
- Consistent error handling
- Proper HTTP status codes
" > docs/architecture.md

echo "# Authentication Guide

## Bearer Token
Include in Authorization header:
\`Authorization: Bearer <token>\`
" > docs/auth.md
```

### Step 3: Update Manifest

Edit `spectrl.json` to include your new files:

```json
{
  "name": "api-spec",
  "version": "1.0.0",
  "description": "REST API specification template",
  "files": ["README.md", "docs/architecture.md", "docs/auth.md"],
  "deps": {},
  "agent": {
    "purpose": "REST API specification template",
    "tags": ["api", "rest", "template"]
  }
}
```

### Step 4: Authenticate with GitHub

```bash
npx spectrl login
```

Please visit: https://github.com/login/device
Enter code: ABCD-1234

Opening browser...
Waiting for authorization...
✓ Logged in as yourusername

````

### Step 5: Publish to Public Registry

```bash
npx spectrl publish
````

**Expected interaction:**

```
? Where do you want to publish?
❯ Local registry (~/.spectrl/registry/)
  Public registry (registry.spectrl.dev)

# Select "Public registry"

Publishing to public registry...
✓ Published yourusername/api-spec@1.0.0
🔗 https://registry.spectrl.dev/yourusername/api-spec
```

### Step 6: Verify Publication

```bash
# Search for your spec
npx spectrl search api-spec

# Get detailed information
npx spectrl info yourusername/api-spec
```

**Expected output:**

```
yourusername/api-spec
REST API specification template

Tags: api, rest, template

Versions:
┌─────────┬──────────────────────┬─────────────┐
│ Version │ Published            │ Downloads   │
├─────────┼──────────────────────┼─────────────┤
│ 1.0.0   │ 2024-12-19 (now)    │ 0           │
└─────────┴──────────────────────┴─────────────┘

Install latest: spectrl install yourusername/api-spec
```

---

## Finding and Installing Specs

Learn how to discover and install specs from the public registry.

### Step 1: Search for Specs

```bash
# Search by keyword
npx spectrl search api
npx spectrl search graphql
npx spectrl search template

# Search by specific terms
npx spectrl search "rest api"
npx spectrl search authentication
```

**Example output:**

```
Found 5 specs matching "api":

┌─────────────────────────┬─────────────────────────────────────┬──────────────────┬─────────┐
│ Spec                    │ Description                         │ Tags             │ Version │
├─────────────────────────┼─────────────────────────────────────┼──────────────────┼─────────┤
│ alice/rest-api          │ Comprehensive REST API template     │ api, rest        │ 2.1.0   │
│ bob/graphql-schema      │ GraphQL schema design patterns      │ api, graphql     │ 1.3.0   │
│ charlie/api-auth        │ API authentication patterns         │ api, auth        │ 1.0.2   │
└─────────────────────────┴─────────────────────────────────────┴──────────────────┴─────────┘
```

### Step 2: Get Detailed Information

```bash
# View all versions and details
npx spectrl info alice/rest-api
```

**Example output:**

```
alice/rest-api
Comprehensive REST API template with examples

Tags: api, rest, openapi, documentation

Versions:
┌─────────┬──────────────────────┬─────────────┐
│ Version │ Published            │ Downloads   │
├─────────┼──────────────────────┼─────────────┤
│ 2.1.0   │ 2024-12-15 (4d ago)  │ 234         │
│ 2.0.0   │ 2024-11-20 (29d ago) │ 189         │
│ 1.5.0   │ 2024-10-10 (70d ago) │ 456         │
└─────────┴──────────────────────┴─────────────┘

Install latest: spectrl install alice/rest-api
Install specific: spectrl install alice/rest-api@2.1.0
```

### Step 3: Install Specs

```bash
# Install latest version
npx spectrl install alice/rest-api

# Install specific version
npx spectrl install alice/rest-api@2.0.0

# Install multiple specs
npx spectrl install bob/graphql-schema
npx spectrl install charlie/api-auth@1.0.2
```

**Expected output:**

```
Resolving alice/rest-api...
Found version 2.1.0
Downloading manifest...
Downloading files...
✓ Installed alice/rest-api@2.1.0
```

### Step 4: Verify Installation

```bash
# List all installed specs
npx spectrl list
```

**Example output:**

```
Installed specs:

┌──────────────────────────┬─────────┬──────────┐
│ Spec                     │ Version │ Source   │
├──────────────────────────┼─────────┼──────────┤
│ alice/rest-api           │ 2.1.0   │ public   │
│ bob/graphql-schema       │ 1.3.0   │ public   │
│ charlie/api-auth         │ 1.0.2   │ public   │
│ my-local-spec            │ 1.0.0   │ local    │
└──────────────────────────┴─────────┴──────────┘

4 specs installed
```

### Step 5: Access Installed Files

```bash
# View the installed spec files
ls .spectrl/specs/alice-rest-api@2.1.0/
cat .spectrl/specs/alice-rest-api@2.1.0/README.md
```

---

## Keeping Specs Up to Date

Learn how to manage spec updates and keep your dependencies current.

### Step 1: Check for Updates

```bash
# Check all installed public specs for updates
npx spectrl update
```

**Example output:**

```
Checking for updates...

Updates available:

┌──────────────────────────┬─────────────┬────────────┐
│ Spec                     │ Installed   │ Latest     │
├──────────────────────────┼─────────────┼────────────┤
│ alice/rest-api           │ 2.0.0       │ 2.1.0      │
│ bob/graphql-schema       │ 1.2.0       │ 1.3.0      │
└──────────────────────────┴─────────────┴────────────┘

Run 'spectrl update <spec>' to update a specific spec
Run 'spectrl update --all' to update all specs
```

### Step 2: Update Specific Specs

```bash
# Update a single spec to latest version
npx spectrl update alice/rest-api

# Update to a specific version
npx spectrl update alice/rest-api@2.1.0
```

**Expected output:**

```
Fetching latest version of alice/rest-api...
Updating to alice/rest-api@2.1.0...

✓ Updated to alice/rest-api@2.1.0
```

### Step 3: Update All Specs

```bash
# Update all specs with available updates
npx spectrl update --all
```

**Expected output:**

```
Updating all specs...

Updating alice/rest-api...
✓ Updated to alice/rest-api@2.1.0

Updating bob/graphql-schema...
✓ Updated to bob/graphql-schema@1.3.0

✓ Updated 2 specs
```

### Step 4: Verify Updates

```bash
# Check that no more updates are available
npx spectrl update
```

**Expected output:**

```
Checking for updates...

✓ All specs are up to date
```

---

## Managing Published Specs

Learn how to update and manage specs you've published to the public registry.

### Updating a Published Spec

#### Step 1: Make Changes Locally

```bash
# Navigate to your spec directory
cd my-api-spec

# Make your changes
echo "
## New Section
Added new authentication methods.
" >> README.md

# Update version in spectrl.json
# Change version from "1.0.0" to "1.1.0"
```

#### Step 2: Publish New Version

```bash
# Publish the updated spec
npx spectrl publish
# Choose "Public registry"
```

**Expected output:**

```
Publishing to public registry...
✓ Published yourusername/api-spec@1.1.0
🔗 https://registry.spectrl.dev/yourusername/api-spec
```

#### Step 3: Verify New Version

```bash
npx spectrl info yourusername/api-spec
```

**Expected output:**

```
yourusername/api-spec
REST API specification template

Versions:
┌─────────┬──────────────────────┬─────────────┐
│ Version │ Published            │ Downloads   │
├─────────┼──────────────────────┼─────────────┤
│ 1.1.0   │ 2024-12-19 (now)    │ 0           │
│ 1.0.0   │ 2024-12-19 (1h ago)  │ 5           │
└─────────┴──────────────────────┴─────────────┘
```

### Unpublishing a Spec Version

⚠️ **Warning**: Unpublishing is permanent and cannot be undone!

```bash
# Unpublish a specific version
npx spectrl unpublish yourusername/api-spec@1.0.0
```

**Expected interaction:**

```
⚠️  This will permanently delete yourusername/api-spec@1.0.0 from the public registry.

? Are you sure you want to continue?
❯ No, cancel
  Yes, delete yourusername/api-spec@1.0.0

# Select "Yes, delete..."

Unpublishing yourusername/api-spec@1.0.0...
✓ Successfully unpublished yourusername/api-spec@1.0.0
```

---

## Working with Local and Public Specs

Learn how to effectively use both local and public registries in your workflow.

### Understanding the Difference

| Aspect             | Local Registry            | Public Registry        |
| ------------------ | ------------------------- | ---------------------- |
| **Storage**        | `~/.spectrl/registry/`    | Cloud (S3 + DynamoDB)  |
| **Access**         | Private to your machine   | Public, searchable     |
| **Authentication** | Not required              | GitHub OAuth required  |
| **Spec Format**    | `my-spec`                 | `username/spec`        |
| **Use Cases**      | Private work, experiments | Sharing, collaboration |

### Mixed Workflow Example

#### Step 1: Set Up Project

```bash
# Initialize project
mkdir my-project
cd my-project
npx spectrl init
```

#### Step 2: Install Public Dependencies

```bash
# Install useful public specs
npx spectrl install alice/rest-api-template
npx spectrl install bob/auth-patterns
npx spectrl install charlie/testing-guide
```

#### Step 3: Create Local Specs

```bash
# Create project-specific specs
npx spectrl new internal-api --description "Internal API specification"
npx spectrl new deployment-guide --description "Deployment procedures"

# Publish to local registry only
npx spectrl publish
# Choose "Local registry"
```

#### Step 4: View Mixed Installation

```bash
npx spectrl list
```

**Expected output:**

```
Installed specs:

┌──────────────────────────┬─────────┬──────────┐
│ Spec                     │ Version │ Source   │
├──────────────────────────┼─────────┼──────────┤
│ alice/rest-api-template  │ 2.1.0   │ public   │
│ bob/auth-patterns        │ 1.5.0   │ public   │
│ charlie/testing-guide    │ 1.2.0   │ public   │
│ internal-api             │ 1.0.0   │ local    │
│ deployment-guide         │ 1.0.0   │ local    │
└──────────────────────────┴─────────┴──────────┘

5 specs installed
```

### Publishing Local Specs Publicly

When you're ready to share a local spec:

```bash
# Navigate to the spec directory
cd path/to/internal-api

# Login if not already authenticated
npx spectrl login

# Publish to public registry
npx spectrl publish
# Choose "Public registry"
```

---

## Troubleshooting Common Issues

Solutions for frequently encountered problems.

### Authentication Problems

#### Issue: Login fails with "bad_verification_code"

**Symptoms:**

```bash
npx spectrl login
# ... after entering code ...
❌ Authentication failed: bad_verification_code
```

**Solutions:**

1. **Double-check the code**: Ensure you're entering the exact code displayed
2. **Try again**: The code might have expired (15-minute timeout)
3. **Check GitHub OAuth App**: Ensure Device Flow is enabled

**Steps to verify GitHub OAuth App:**

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Select your Spectrl OAuth app
3. Ensure "Device Flow" checkbox is checked ✅
4. Save changes if needed

#### Issue: "Invalid client_id" error

**Symptoms:**

```bash
npx spectrl login
❌ Failed to initiate authentication
```

**Solutions:**

1. **Contact support**: This indicates a configuration issue
2. **Check environment**: Ensure you're using the correct API endpoint

### Network and API Issues

#### Issue: Commands timeout or fail with network errors

**Symptoms:**

```bash
npx spectrl search api
❌ Search failed: Network timeout
```

**Solutions:**

1. **Check internet connection**
2. **Verify API endpoint**:
   ```bash
   echo $API_URL
   # Should show: https://api.spectrl.dev (or similar)
   ```
3. **Try again later**: Temporary service issues
4. **Check firewall/proxy settings**

#### Issue: "API_URL environment variable is required"

**Symptoms:**

```bash
npx spectrl login
❌ API_URL environment variable is required
```

**Solution:**

```bash
# Set the API URL (usually not needed in production)
export API_URL="https://api.spectrl.dev"

# Or add to your shell profile
echo 'export API_URL="https://api.spectrl.dev"' >> ~/.bashrc
source ~/.bashrc
```

### Spec Installation Issues

#### Issue: "Spec not found" when installing

**Symptoms:**

```bash
npx spectrl install alice/nonexistent-spec
❌ Spec not found: alice/nonexistent-spec
```

**Solutions:**

1. **Verify spec name**:
   ```bash
   spectrl search alice
   spectrl info alice/correct-spec-name
   ```
2. **Check spelling**: Ensure username and spec name are correct
3. **Verify it's public**: Local specs don't have username prefix

#### Issue: Symlink creation fails

**Symptoms:**

```bash
npx spectrl install alice/api-spec
⚠️  Symlink creation failed, falling back to copy
✓ Installed alice/api-spec@1.0.0
```

**Solutions:**

- **Windows**: This is expected behavior, no action needed
- **macOS/Linux**: Check file permissions, usually not a problem
- **Files are copied instead of linked**: Functionality is preserved

### Publishing Issues

#### Issue: Publish fails with authentication error

**Symptoms:**

```bash
npx spectrl publish
# Choose "Public registry"
❌ You need to login first. Run: spectrl login
```

**Solutions:**

1. **Login first**:
   ```bash
   spectrl login
   spectrl publish
   ```
2. **Check token validity**:
   ```bash
   spectrl whoami
   ```
3. **Re-authenticate if needed**:
   ```bash
   spectrl logout
   spectrl login
   ```

#### Issue: "agent field missing" error

**Symptoms:**

```bash
npx spectrl publish
❌ Publish failed: agent field missing
```

**Solutions:**

1. **Spectrl auto-populates this**: Usually not an issue
2. **Check spectrl.json format**:
   ```json
   {
     "name": "my-spec",
     "version": "1.0.0",
     "description": "My spec description",
     "files": ["README.md"],
     "deps": {},
     "agent": {
       "purpose": "My spec description",
       "tags": ["tag1", "tag2"]
     }
   }
   ```

### Token Storage Issues

#### Issue: Token doesn't persist between sessions

**Symptoms:**

```bash
npx spectrl whoami
Not logged in
# But you logged in recently
```

**Solutions:**

**macOS:**

```bash
# Check Keychain Access permissions
# Look for "spectrl" entries in Keychain Access app
```

**Linux:**

```bash
# Install libsecret if missing
sudo apt-get install libsecret-1-dev  # Ubuntu/Debian
sudo yum install libsecret-devel      # CentOS/RHEL
```

**All platforms:**

```bash
# Check fallback file permissions
ls -la ~/.spectrl/.auth
# Should be: -rw------- (600 permissions)
```

### Version and Update Issues

#### Issue: Update shows no available updates but spec has newer version

**Symptoms:**

```bash
npx spectrl update
✓ All specs are up to date

# But you know there's a newer version
npx spectrl info alice/api-spec
# Shows newer version exists
```

**Solutions:**

1. **Check installed version**:
   ```bash
   spectrl list
   # Compare with spectrl info output
   ```
2. **Force update to specific version**:
   ```bash
   spectrl update alice/api-spec@2.1.0
   ```
3. **Semantic versioning**: Ensure versions follow semver format

### Getting Help

If you're still experiencing issues:

1. **Check the documentation**: [docs.spectrl.dev](https://docs.spectrl.dev)
2. **Search existing issues**: [GitHub Issues](https://github.com/spectrl/spectrl/issues)
3. **Create a new issue**: Include:
   - Command you ran
   - Expected behavior
   - Actual behavior
   - Error messages
   - Operating system
   - Spectrl CLI version (`spectrl --version`)

**Useful debugging information:**

```bash
# Get CLI version
npx spectrl --version

# Check environment
echo "API_URL: $API_URL"
echo "REGISTRY_URL: $REGISTRY_URL"

# Check authentication status
npx spectrl whoami

# List installed specs
npx spectrl list
```
