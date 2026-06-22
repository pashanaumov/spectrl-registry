# Phase 3: CLI Public Registry Features - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Spectrl CLI                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Existing Commands:                                          │
│  • spectrl init                                              │
│  • spectrl new                                               │
│  • spectrl publish (local)                                   │
│  • spectrl install (local)                                   │
│                                                               │
│  New Commands:                                               │
│  • spectrl login (GitHub Device Flow)                        │
│  • spectrl logout                                            │
│  • spectrl whoami                                            │
│  • spectrl publish (with public option)                      │
│  • spectrl install username/spec (public)                    │
│  • spectrl search                                            │
│  • spectrl info                                              │
│                                                               │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Token Storage
             ▼
    ┌────────────────────┐
    │   OS Keychain      │  (macOS Keychain, Windows Credential
    │   or Encrypted     │   Manager, Linux Secret Service)
    │   File Storage     │
    └────────────────────┘
             │
             │ API Calls (HTTPS)
             ▼
    ┌────────────────────────────────────────────────────────┐
    │   Public Registry API (AWS Lambda + API Gateway)       │
    ├────────────────────────────────────────────────────────┤
    │  • POST /auth/device/init    - Initiate device flow    │
    │  • POST /auth/device/poll    - Poll for authorization  │
    │  • POST /publish             - Publish spec            │
    │  • GET  /search              - Search specs            │
    │  • GET  /specs/{user}/{name} - Get spec metadata       │
    └────────────┬───────────────────────────────────────────┘
                 │
                 │ OAuth Device Flow
                 ▼
         ┌───────────────┐
         │  GitHub API   │
         └───────────────┘
```

**Key Design Decision: Device Flow vs Web Flow**

We're using GitHub Device Flow instead of a traditional OAuth web flow with callback URL because:

1. **No local server needed** - Eliminates port conflicts, firewall issues
2. **Works everywhere** - Containers, remote environments, SSH sessions
3. **Better UX** - User sees verification code, can verify on any device
4. **Industry standard** - Used by GitHub CLI, AWS CLI, Azure CLI
5. **More secure** - No callback URL to intercept or redirect
6. **Simpler infrastructure** - Just two Lambda endpoints, no callback handling

## Prerequisites

### GitHub OAuth App Configuration

**IMPORTANT:** You must enable Device Flow on your GitHub OAuth App before implementing Phase 3.

**Steps:**

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Select your Spectrl OAuth app
3. **Enable Device Flow** checkbox ✅
4. Save changes

**Why this is required:**

- Device Flow is a separate OAuth grant type
- Must be explicitly enabled per OAuth app
- Without it, the device flow endpoints will fail with 401/403 errors
- This is different from the standard web flow (authorization code grant)

**Verification:**

After enabling, test with curl:

```bash
curl -X POST https://github.com/login/device/code \
  -H "Accept: application/json" \
  -d "client_id=YOUR_CLIENT_ID&scope=user:email"
```

Should return:

```json
{
  "device_code": "xxx",
  "user_code": "ABCD-1234",
  "verification_uri": "https://github.com/login/device",
  "expires_in": 900,
  "interval": 5
}
```

If you get an error, Device Flow is not enabled.

## Backend API Changes

### New Lambda Functions

We need to add two new Lambda functions to support GitHub Device Flow. These will follow the same pattern as existing Lambdas.

#### Lambda 1: auth-device-init

**Location:** `api/auth-device-init/index.ts`

**Purpose:** Initiates the GitHub Device Flow

**API Endpoint:** `POST /auth/device/init`

**Request:** Empty body

**Response:**

```json
{
  "device_code": "xxx",
  "user_code": "ABCD-1234",
  "verification_uri": "https://github.com/login/device",
  "expires_in": 900,
  "interval": 5
}
```

**Implementation:**

```typescript
// api/auth-device-init/index.ts
import { getGithubOAuthCredentials } from '../auth-exchange/helpers/credentials';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get client_id from Secrets Manager (reuse existing helper)
    const { clientId } = await getGithubOAuthCredentials();

    // Call GitHub Device Flow API
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'user:email',
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error initiating device flow:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to initiate device flow' }),
    };
  }
}
```

- Retrieve GitHub client_id from Secrets Manager using existing helper
- No environment variables needed for credentials
- Call GitHub Device Flow API: `POST https://github.com/login/device/code`
- Return GitHub's response directly to CLI
- Add error handling for GitHub API failures

**IAM Permissions Needed:**

- CloudWatch Logs (CreateLogGroup, CreateLogStream, PutLogEvents)
- Secrets Manager (GetSecretValue) - for github_oauth_secret_arn

**Terraform Resources:**

- IAM role: `aws_iam_role.auth_device_init`
- IAM policy: `aws_iam_role_policy.auth_device_init`
- Lambda function: `aws_lambda_function.auth_device_init`
- CloudWatch log group: `aws_cloudwatch_log_group.auth_device_init`
- Archive file: `data.archive_file.auth_device_init`

#### Lambda 2: auth-device-poll

**Location:** `api/auth-device-poll/index.ts`

**Purpose:** Polls for device authorization completion

**API Endpoint:** `POST /auth/device/poll`

**Request:**

```json
{
  "device_code": "xxx"
}
```

**Response (Success - 200):**

```json
{
  "token": "gho_xxx",
  "username": "alice"
}
```

**Response (Pending - 202):**

```json
{
  "status": "authorization_pending"
}
```

**Response (Error - 400):**

```json
{
  "error": "expired_token",
  "message": "The device code has expired"
}
```

**Implementation:**

```typescript
// api/auth-device-poll/index.ts
import { getGithubOAuthCredentials } from '../auth-exchange/helpers/credentials';
import { getGitHubUser } from '../auth-exchange/helpers/credentials';
import { storeUser } from '../auth-exchange/helpers/dynamoDb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { device_code } = body;

    if (!device_code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'device_code is required' }),
      };
    }

    // Get credentials from Secrets Manager
    const { clientId } = await getGithubOAuthCredentials();

    // Poll GitHub for authorization
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await response.json();

    // Handle different GitHub responses
    if (data.error === 'authorization_pending' || data.error === 'slow_down') {
      return {
        statusCode: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'authorization_pending' }),
      };
    }

    if (data.error === 'expired_token' || data.error === 'access_denied') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.error, message: data.error_description }),
      };
    }

    // Success - we have an access token
    const accessToken = data.access_token;

    // Get user info and store in DynamoDB (reuse existing helpers)
    const user = await getGitHubUser(accessToken);
    await storeUser(user);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken, username: user.username }),
    };
  } catch (error) {
    console.error('Error polling device authorization:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
```

- Retrieve GitHub client_id from Secrets Manager using existing helper
- Call GitHub Device Flow API: `POST https://github.com/login/oauth/access_token`
- Handle different response codes from GitHub:
  - `authorization_pending` → Return 202
  - `slow_down` → Return 202 with message
  - `expired_token` → Return 400
  - `access_denied` → Return 400
  - Success → Continue to next steps
- If authorized, fetch user info from GitHub API (reuse existing helper)
- Store user in DynamoDB (reuse existing helper from auth-exchange)
- Return token and username

**IAM Permissions Needed:**

- CloudWatch Logs (CreateLogGroup, CreateLogStream, PutLogEvents)
- Secrets Manager (GetSecretValue) - for github_oauth_secret_arn
- DynamoDB (PutItem) - for users_table_arn

**Terraform Resources:**

- IAM role: `aws_iam_role.auth_device_poll`
- IAM policy: `aws_iam_role_policy.auth_device_poll`
- Lambda function: `aws_lambda_function.auth_device_poll`
- CloudWatch log group: `aws_cloudwatch_log_group.auth_device_poll`
- Archive file: `data.archive_file.auth_device_poll`

### API Gateway Changes

**New Resources:**

- `/auth/device` - Parent resource under `/auth`
- `/auth/device/init` - Resource for init endpoint
- `/auth/device/poll` - Resource for poll endpoint

**New Routes:**

- `POST /auth/device/init` → auth-device-init Lambda
- `POST /auth/device/poll` → auth-device-poll Lambda
- `OPTIONS /auth/device/init` → CORS mock
- `OPTIONS /auth/device/poll` → CORS mock

**Terraform Changes:**

- Add to `infra/modules/api-gateway/main.tf`:
  - `aws_api_gateway_resource.auth_device`
  - `aws_api_gateway_resource.auth_device_init`
  - `aws_api_gateway_resource.auth_device_poll`
  - Methods and integrations for both endpoints
  - CORS configuration for both endpoints
  - Lambda permissions for API Gateway invocation

- Add to `infra/modules/lambda/outputs.tf`:
  - `auth_device_init_function_name`
  - `auth_device_init_invoke_arn`
  - `auth_device_poll_function_name`
  - `auth_device_poll_invoke_arn`

- Add to `infra/environments/prod/main.tf`:
  - Pass new Lambda outputs to api_gateway module

### Reusable Code

Both new Lambdas can reuse existing helpers:

- `api/shared/github.ts` - GitHub API helpers
- `api/auth-exchange/helpers/credentials.ts` - OAuth credential retrieval
- `api/auth-exchange/helpers/dynamoDb.ts` - User storage

### Keep Existing auth-exchange Lambda

We'll keep the existing `POST /auth/exchange` Lambda for backward compatibility, even though the CLI will use Device Flow.

## Token Management

### Using Keytar

**What is Keytar?**

- Node.js module for accessing OS credential storage
- Works on macOS, Windows, Linux
- Secure storage backed by OS

**Installation:**

```bash
npm install keytar
npm install --save-dev @types/keytar
```

**API:**

```typescript
import keytar from 'keytar';

// Store token
await keytar.setPassword('spectrl', 'github-token', token);

// Retrieve token
const token = await keytar.getPassword('spectrl', 'github-token');

// Delete token
await keytar.deletePassword('spectrl', 'github-token');
```

### Fallback: Encrypted File Storage

If keytar fails (e.g., no keychain available), fall back to encrypted file:

**Location:** `~/.spectrl/.auth`

**Encryption:**

```typescript
import crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';

// Use machine ID as encryption key
const key = machineIdSync();

// Encrypt token
const cipher = crypto.createCipher('aes-256-cbc', key);
const encrypted = cipher.update(token, 'utf8', 'hex') + cipher.final('hex');

// Decrypt token
const decipher = crypto.createDecipher('aes-256-cbc', key);
const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
```

**File permissions:** `0600` (read/write for owner only)

### TokenManager Class

```typescript
// src/auth/token-manager.ts
export class TokenManager {
  async store(token: string): Promise<void> {
    try {
      await keytar.setPassword('spectrl', 'github-token', token);
    } catch (error) {
      this.storeEncrypted(token);
    }
  }

  async get(): Promise<string | null> {
    try {
      return await keytar.getPassword('spectrl', 'github-token');
    } catch (error) {
      return this.getEncrypted();
    }
  }

  async delete(): Promise<void> {
    try {
      await keytar.deletePassword('spectrl', 'github-token');
    } catch (error) {
      this.deleteEncrypted();
    }
  }

  private storeEncrypted(token: string): void {
    /* ... */
  }
  private getEncrypted(): string | null {
    /* ... */
  }
  private deleteEncrypted(): void {
    /* ... */
  }
}
```

## Authentication Commands

### spectrl login

**Flow (GitHub Device Flow):**

1. CLI calls Lambda to initiate device flow
2. Lambda calls GitHub Device Flow API and returns device code + user code
3. CLI displays user code and opens browser to GitHub verification URL
4. User enters code on GitHub and authorizes
5. CLI polls Lambda to check authorization status
6. Once authorized, Lambda exchanges device code for access token
7. Lambda returns token to CLI
8. CLI stores token using TokenManager
9. Show success message

**Why Device Flow?**

- No local server needed (works in containers, remote environments)
- No port conflicts or firewall issues
- Standard approach for CLI tools (GitHub CLI, AWS CLI, etc.)
- Better UX - user sees verification code
- More secure - no callback URL to intercept

**What the `/poll` endpoint does:**

The `/poll` endpoint is the "are we there yet?" checker. Here's the detailed flow:

1. **CLI sends `device_code` to `/poll`**
   - This is the secret code from step 1 (not the user code)
2. **Lambda asks GitHub: "Is this device authorized?"**
   - Calls `POST https://github.com/login/oauth/access_token` with `device_code`
3. **GitHub responds with one of:**
   - `authorization_pending` → User hasn't authorized yet → Lambda returns **202** (keep polling)
   - `slow_down` → Polling too fast → Lambda returns **202** (slow down)
   - `expired_token` → 15 minutes passed → Lambda returns **400** (timeout)
   - `access_denied` → User clicked "Deny" → Lambda returns **400** (denied)
   - **Success** → User authorized → GitHub returns `access_token` → Lambda returns **200** with token

4. **CLI keeps polling every 5 seconds until:**
   - ✅ Gets 200 (success) → Stores token, stops polling
   - ❌ Gets 400 (error) → Shows error, stops polling
   - ⏱️ Timeout (15 min) → Shows timeout error, stops polling

**Why polling instead of webhooks?**

GitHub doesn't send a webhook when the user authorizes. The CLI must repeatedly ask "is it done yet?" This is standard for OAuth Device Flow (RFC 8628).

**Implementation:**

```typescript
// src/commands/login.ts
import open from 'open';
import { TokenManager } from '../auth/token-manager';

const API_URL =
  process.env.API_URL || 'https://bpleokxqv5.execute-api.eu-north-1.amazonaws.com/prod';

export async function loginCommand() {
  const tokenManager = new TokenManager();

  console.log('Initiating GitHub authentication...\n');

  // Step 1: Initiate device flow via Lambda
  const initResponse = await fetch(`${API_URL}/auth/device/init`, {
    method: 'POST',
  });

  if (!initResponse.ok) {
    console.error('❌ Failed to initiate authentication');
    process.exit(1);
  }

  const { device_code, user_code, verification_uri, expires_in, interval } =
    await initResponse.json();

  // Step 2: Display code and open browser
  console.log(`Please visit: ${verification_uri}`);
  console.log(`\nEnter code: ${user_code}\n`);
  console.log('Opening browser...\n');

  await open(verification_uri);

  // Step 3: Poll for authorization
  const startTime = Date.now();
  const expiresAt = startTime + expires_in * 1000;

  console.log('Waiting for authorization...');

  while (Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const pollResponse = await fetch(`${API_URL}/auth/device/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_code }),
    });

    if (pollResponse.status === 200) {
      // Success!
      const { token, username } = await pollResponse.json();

      // Store token
      await tokenManager.store(token);

      console.log(`\n✓ Logged in as ${username}`);
      return;
    } else if (pollResponse.status === 202) {
      // Still waiting (authorization_pending)
      continue;
    } else if (pollResponse.status === 400) {
      // Expired or denied
      const error = await pollResponse.json();
      console.error(`\n❌ Authentication failed: ${error.message}`);
      process.exit(1);
    }
  }

  console.error('\n❌ Authentication timed out');
  process.exit(1);
}
```

### spectrl logout

**Flow:**

1. Delete token using TokenManager
2. Show success message

**Implementation:**

```typescript
// src/commands/logout.ts
export async function logoutCommand() {
  const tokenManager = new TokenManager();
  await tokenManager.delete();
  console.log('✓ Logged out');
}
```

### spectrl whoami

**Flow:**

1. Get token using TokenManager
2. If no token, show "Not logged in"
3. Verify token with GitHub API
4. Show username

**Implementation:**

```typescript
// src/commands/whoami.ts
export async function whoamiCommand() {
  const tokenManager = new TokenManager();
  const token = await tokenManager.get();

  if (!token) {
    console.log('Not logged in');
    return;
  }

  // Verify token with GitHub
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    console.log('Token invalid. Run: spectrl login');
    return;
  }

  const user = await response.json();
  console.log(`Logged in as ${user.login}`);
}
```

## API Client Utility

The API client wraps all public registry API calls:

```typescript
// src/utils/api-client.ts

const API_URL =
  process.env.API_URL || 'https://bpleokxqv5.execute-api.eu-north-1.amazonaws.com/prod';

export async function initiateDeviceFlow() {
  const response = await fetch(`${API_URL}/auth/device/init`, {
    method: 'POST',
  });
  return response.json();
}

export async function pollDeviceAuthorization(deviceCode: string) {
  const response = await fetch(`${API_URL}/auth/device/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
  });
  return { status: response.status, data: await response.json() };
}

export async function publishSpec(token: string, manifest: any, files: any[]) {
  const response = await fetch(`${API_URL}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ manifest, files }),
  });
  return response.json();
}

export async function searchSpecs(query: string) {
  const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
  return response.json();
}

export async function getSpec(username: string, name: string) {
  const response = await fetch(`${API_URL}/specs/${username}/${name}`);
  return response.json();
}
```

## Publishing to Public Registry

### Extend spectrl publish

**Flow:**

1. Read manifest from current directory
2. Validate manifest
3. Prompt: "Where do you want to publish?"
   - Local registry
   - Public registry
4. If public:
   - Check if logged in
   - Read all spec files
   - Package files with content
   - POST to API with token
   - Show success message with URL
5. If local:
   - Use existing local publish logic

**Implementation:**

```typescript
// src/commands/publish.ts
import inquirer from 'inquirer';

export async function publishCommand() {
  const manifest = readManifest('./spectrl.json');
  validateManifest(manifest);

  // Prompt for destination
  const { destination } = await inquirer.prompt([
    {
      type: 'list',
      name: 'destination',
      message: 'Where do you want to publish?',
      choices: [
        { name: 'Local registry (~/.spectrl/registry/)', value: 'local' },
        { name: 'Public registry (registry.spectrl.dev)', value: 'public' },
      ],
    },
  ]);

  if (destination === 'local') {
    return publishLocal(manifest);
  }

  // Public publish
  const tokenManager = new TokenManager();
  const token = await tokenManager.get();

  if (!token) {
    console.error('⚠️  You need to login first. Run: spectrl login');
    process.exit(1);
  }

  // Auto-populate agent field if missing
  if (!manifest.agent) {
    manifest.agent = {
      purpose: manifest.description || '',
      tags: [],
    };
  }

  // Read all files
  const files = await readSpecFiles(manifest.files);

  // Upload to API
  const response = await fetch(`${API_URL}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ manifest, files }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Publish failed: ${error}`);
    process.exit(1);
  }

  const result = await response.json();
  console.log(`✓ ${result.message}`);
  console.log(`🔗 ${result.url}`);
}
```

## Installing from Public Registry

### Extend spectrl install

**Spec Reference Formats:**

- `my-spec` - Local registry
- `my-spec@1.0.0` - Local registry, specific version
- `alice/my-spec` - Public registry, latest version
- `alice/my-spec@1.0.0` - Public registry, specific version

**Flow:**

1. Parse spec reference
2. If contains `/`, it's public
3. Fetch spec metadata from API
4. Determine version (latest if not specified)
5. Download manifest from CloudFront
6. Download all files from CloudFront
7. Save to `.spectrl/specs/`
8. Update project index

**Implementation:**

```typescript
// src/commands/install.ts
export async function installCommand(specRef?: string) {
  if (!specRef) {
    // Restore from index (existing logic)
    return restoreFromIndex();
  }

  // Parse spec reference
  const parsed = parseSpecRef(specRef);

  if (parsed.username) {
    // Public registry install
    return installFromPublic(parsed);
  } else {
    // Local registry install (existing logic)
    return installFromLocal(parsed);
  }
}

async function installFromPublic({ username, name, version }: any) {
  console.log(`Resolving ${username}/${name}...`);

  // Get spec metadata
  const metaResponse = await fetch(`${API_URL}/specs/${username}/${name}`);

  if (!metaResponse.ok) {
    console.error(`❌ Spec not found: ${username}/${name}`);
    process.exit(1);
  }

  const meta = await metaResponse.json();

  // Determine version
  const targetVersion = version || meta.versions[0].version;
  const versionMeta = meta.versions.find((v: any) => v.version === targetVersion);

  if (!versionMeta) {
    console.error(`❌ Version ${targetVersion} not found`);
    process.exit(1);
  }

  console.log(`Found version ${targetVersion}`);

  // Download manifest
  // Note: s3Path format is "specs/{username}/{specName}/{version}"
  // Files are served via CloudFront CDN (or direct S3 URL)
  const REGISTRY_URL =
    process.env.REGISTRY_URL || 'https://spectrl-registry-prod.s3.eu-north-1.amazonaws.com';
  const manifestUrl = `${REGISTRY_URL}/${versionMeta.s3Path}/spectrl.json`;
  const manifestResponse = await fetch(manifestUrl);
  const manifest = await manifestResponse.json();

  // Download files
  const specDir = path.join('.spectrl', 'specs', `${username}-${name}@${targetVersion}`);
  fs.mkdirSync(specDir, { recursive: true });

  // Save manifest
  fs.writeFileSync(path.join(specDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));

  // Download each file
  for (const file of manifest.files) {
    const fileUrl = `${REGISTRY_URL}/${versionMeta.s3Path}/files/${file}`;
    const fileResponse = await fetch(fileUrl);
    const content = await fileResponse.text();

    const filePath = path.join(specDir, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  // Update index
  updateIndex({
    key: `${username}/${name}@${targetVersion}`,
    source: manifestUrl,
    hash: versionMeta.hash,
  });

  console.log(`✓ Installed ${username}/${name}@${targetVersion}`);
}
```

## Management Commands

### spectrl unpublish

**Flow:**

1. Parse spec reference (must include version)
2. Check if user is logged in
3. Confirm with user (destructive operation)
4. Call DELETE endpoint
5. Show success message

**Output Format:**

```
$ spectrl unpublish alice/api-spec@1.0.0

⚠️  This will permanently delete alice/api-spec@1.0.0 from the public registry.
? Are you sure? (y/N) y

Unpublishing alice/api-spec@1.0.0...
✓ Successfully unpublished alice/api-spec@1.0.0
```

**Implementation:**

```typescript
// src/commands/unpublish.ts
import chalk from 'chalk';
import inquirer from 'inquirer';

export async function unpublishCommand(specRef: string) {
  const tokenManager = new TokenManager();
  const token = await tokenManager.get();

  if (!token) {
    console.error(chalk.red('✗ You need to login first. Run: spectrl login'));
    process.exit(1);
  }

  // Parse spec reference
  const { username, name, version } = parseSpecRef(specRef);

  if (!version) {
    console.error(chalk.red('✗ Version is required for unpublish'));
    console.log(chalk.dim('Usage: spectrl unpublish <username>/<spec>@<version>'));
    process.exit(1);
  }

  // Confirm with user
  console.log(
    chalk.yellow(
      `\n⚠️  This will permanently delete ${username}/${name}@${version} from the public registry.`,
    ),
  );
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Are you sure?',
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.dim('Cancelled'));
    return;
  }

  // Call API
  console.log(chalk.dim(`\nUnpublishing ${username}/${name}@${version}...`));

  const response = await fetch(`${API_URL}/specs/${username}/${name}/${version}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(chalk.red(`✗ Unpublish failed: ${error.error || error.message}`));
    process.exit(1);
  }

  console.log(chalk.green(`✓ Successfully unpublished ${username}/${name}@${version}\n`));
}
```

### spectrl update

**Flow:**

1. Read project index to get installed specs
2. For each public spec, check if newer version exists
3. Show available updates
4. Optionally update all or specific specs

**Output Format:**

```
$ spectrl update

Checking for updates...

Updates available:
┌──────────────────────────┬─────────────┬────────────┐
│ Spec                     │ Installed   │ Latest     │
├──────────────────────────┼─────────────┼────────────┤
│ alice/api-spec           │ 2.0.0       │ 2.1.0      │
│ bob/graphql-api          │ 1.5.0       │ 1.5.2      │
└──────────────────────────┴─────────────┴────────────┘

Run 'spectrl update <spec>' to update a specific spec
Run 'spectrl update --all' to update all specs
```

**Implementation:**

```typescript
// src/commands/update.ts
import Table from 'cli-table3';
import chalk from 'chalk';
import semver from 'semver';

export async function updateCommand(specRef?: string, options?: { all?: boolean }) {
  const index = readIndex();
  const publicSpecs = Object.entries(index).filter(
    ([_, data]: [string, any]) =>
      data.source.startsWith('https://') || data.source.startsWith('http://'),
  );

  if (publicSpecs.length === 0) {
    console.log(chalk.yellow('No public specs installed'));
    return;
  }

  // If specific spec provided, update it
  if (specRef) {
    return updateSingleSpec(specRef);
  }

  // Check for updates
  console.log(chalk.dim('Checking for updates...\n'));

  const updates: Array<{ spec: string; current: string; latest: string }> = [];

  for (const [key, data] of publicSpecs) {
    const [specName, currentVersion] = key.split('@');
    const { username, name } = parseSpecRef(specName);

    // Fetch latest version from API
    const response = await fetch(`${API_URL}/specs/${username}/${name}`);
    if (!response.ok) continue;

    const { versions } = await response.json();
    const latestVersion = versions[0]?.version;

    if (latestVersion && semver.gt(latestVersion, currentVersion)) {
      updates.push({
        spec: specName,
        current: currentVersion,
        latest: latestVersion,
      });
    }
  }

  if (updates.length === 0) {
    console.log(chalk.green('✓ All specs are up to date\n'));
    return;
  }

  // Show updates table
  console.log(chalk.bold('Updates available:\n'));

  const table = new Table({
    head: [chalk.cyan('Spec'), chalk.cyan('Installed'), chalk.cyan('Latest')],
    colWidths: [30, 15, 15],
    style: {
      head: [],
      border: ['dim'],
    },
  });

  updates.forEach(({ spec, current, latest }) => {
    table.push([chalk.bold(spec), chalk.yellow(current), chalk.green(latest)]);
  });

  console.log(table.toString());
  console.log(chalk.dim(`\nRun 'spectrl update <spec>' to update a specific spec`));
  console.log(chalk.dim(`Run 'spectrl update --all' to update all specs\n`));

  // If --all flag, update all
  if (options?.all) {
    for (const { spec, latest } of updates) {
      await updateSingleSpec(`${spec}@${latest}`);
    }
  }
}

async function updateSingleSpec(specRef: string) {
  console.log(chalk.dim(`Updating ${specRef}...`));

  // Uninstall old version (remove from index and files)
  const { username, name, version } = parseSpecRef(specRef);
  const oldKey = Object.keys(readIndex()).find((k) => k.startsWith(`${username}/${name}@`));
  if (oldKey) {
    // Remove old files
    const specDir = path.join('.spectrl', 'specs', oldKey.replace('/', '-'));
    if (fs.existsSync(specDir)) {
      fs.rmSync(specDir, { recursive: true });
    }
    // Remove from index
    const index = readIndex();
    delete index[oldKey];
    writeIndex(index);
  }

  // Install new version (reuse install logic)
  await installFromPublic({ username, name, version });

  console.log(chalk.green(`✓ Updated to ${specRef}\n`));
}
```

**Additional Dependency:**

```bash
npm install semver
npm install --save-dev @types/semver
```

**Why semver?**

- Standard library for semantic version comparison
- Used by npm, yarn, and most package managers
- Handles version ranges and comparisons correctly

## Discovery Commands

### spectrl search

**Flow:**

1. Query API with search term
2. Format results in a nice table
3. Show spec ID, description, tags, and version

**Output Format:**

```
$ spectrl search api

Found 3 specs:

┌─────────────────────────┬─────────────────────────────────────┬──────────────────┬─────────┐
│ Spec                    │ Description                         │ Tags             │ Version │
├─────────────────────────┼─────────────────────────────────────┼──────────────────┼─────────┤
│ alice/api-spec          │ REST API specification template     │ api, rest        │ 2.1.0   │
│ bob/graphql-api         │ GraphQL API design patterns         │ api, graphql     │ 1.5.2   │
│ charlie/openapi-starter │ OpenAPI 3.0 starter template        │ api, openapi     │ 1.0.0   │
└─────────────────────────┴─────────────────────────────────────┴──────────────────┴─────────┘

Install with: spectrl install <spec>
```

**Implementation:**

```typescript
// src/commands/search.ts
import Table from 'cli-table3';
import chalk from 'chalk';

export async function searchCommand(query: string) {
  const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    console.error(chalk.red('✗ Search failed'));
    process.exit(1);
  }

  const { results } = await response.json();

  if (results.length === 0) {
    console.log(chalk.yellow('No specs found'));
    console.log(chalk.dim('Try a different search term or browse all specs with: spectrl search'));
    return;
  }

  console.log(chalk.bold(`\nFound ${results.length} spec${results.length === 1 ? '' : 's'}:\n`));

  // Create table
  const table = new Table({
    head: [
      chalk.cyan('Spec'),
      chalk.cyan('Description'),
      chalk.cyan('Tags'),
      chalk.cyan('Version'),
    ],
    colWidths: [25, 40, 20, 10],
    wordWrap: true,
    style: {
      head: [],
      border: ['dim'],
    },
  });

  // Add rows
  results.forEach((spec: any) => {
    table.push([
      chalk.bold(spec.specId),
      spec.description || chalk.dim('No description'),
      spec.agentTags?.join(', ') || chalk.dim('none'),
      spec.version,
    ]);
  });

  console.log(table.toString());
  console.log(chalk.dim('\nInstall with: spectrl install <spec>'));
}
```

**Dependencies:**

```bash
npm install cli-table3 chalk
npm install --save-dev @types/cli-table3
```

**Why these libraries?**

- **cli-table3**: Modern, well-maintained table library with great formatting
- **chalk**: Terminal colors and styling (widely used, 100M+ downloads/week)

### spectrl info

**Flow:**

1. Parse spec reference
2. Fetch spec metadata from API
3. Show all versions with details in a nice format

**Output Format:**

```
$ spectrl info alice/api-spec

alice/api-spec
REST API specification template

Tags: api, rest, openapi

Versions:
┌─────────┬──────────────────────┬─────────────┐
│ Version │ Published            │ Downloads   │
├─────────┼──────────────────────┼─────────────┤
│ 2.1.0   │ 2024-12-08 (2d ago)  │ 145         │
│ 2.0.0   │ 2024-11-15 (23d ago) │ 89          │
│ 1.5.0   │ 2024-10-01 (68d ago) │ 234         │
└─────────┴──────────────────────┴─────────────┘

Install latest: spectrl install alice/api-spec
Install specific: spectrl install alice/api-spec@2.1.0
```

**Implementation:**

```typescript
// src/commands/info.ts
import Table from 'cli-table3';
import chalk from 'chalk';
import { formatDistanceToNow } from 'date-fns';

export async function infoCommand(specRef: string) {
  const { username, name } = parseSpecRef(specRef);

  const response = await fetch(`${API_URL}/specs/${username}/${name}`);

  if (!response.ok) {
    console.error(chalk.red(`✗ Spec not found: ${username}/${name}`));
    process.exit(1);
  }

  const spec = await response.json();

  // Header
  console.log(chalk.bold.cyan(`\n${spec.specId}`));
  if (spec.versions[0]?.description) {
    console.log(spec.versions[0].description);
  }

  // Tags
  if (spec.versions[0]?.agentTags?.length > 0) {
    console.log(chalk.dim(`\nTags: ${spec.versions[0].agentTags.join(', ')}`));
  }

  // Versions table
  console.log(chalk.bold('\nVersions:'));
  const table = new Table({
    head: [chalk.cyan('Version'), chalk.cyan('Published'), chalk.cyan('Downloads')],
    colWidths: [10, 25, 15],
    style: {
      head: [],
      border: ['dim'],
    },
  });

  spec.versions.forEach((v: any) => {
    const publishedDate = new Date(v.publishedAt);
    const relativeTime = formatDistanceToNow(publishedDate, { addSuffix: true });
    const formattedDate = `${publishedDate.toISOString().split('T')[0]} (${relativeTime})`;

    table.push([chalk.bold(v.version), formattedDate, v.downloads?.toString() || '0']);
  });

  console.log(table.toString());

  // Install instructions
  console.log(chalk.dim(`\nInstall latest: spectrl install ${spec.specId}`));
  console.log(chalk.dim(`Install specific: spectrl install ${spec.specId}@<version>\n`));
}
```

**Additional Dependency:**

```bash
npm install date-fns
```

**Why date-fns?**

- Lightweight date formatting library
- Provides human-readable relative times ("2 days ago")
- Tree-shakeable (only import what you need)

### spectrl list (enhanced)

**Flow:**

1. Read project index
2. Show all installed specs in a table
3. Indicate source (local or public)

**Output Format:**

```
$ spectrl list

Installed specs:

┌──────────────────────────┬─────────┬──────────┐
│ Spec                     │ Version │ Source   │
├──────────────────────────┼─────────┼──────────┤
│ alice/api-spec           │ 2.1.0   │ public   │
│ bob/graphql-api          │ 1.5.2   │ public   │
│ my-local-spec            │ 1.0.0   │ local    │
└──────────────────────────┴─────────┴──────────┘

3 specs installed
```

**Implementation:**

```typescript
// src/commands/list.ts
import Table from 'cli-table3';
import chalk from 'chalk';

export async function listCommand() {
  const index = readIndex();
  const entries = Object.entries(index);

  if (entries.length === 0) {
    console.log(chalk.yellow('No specs installed'));
    console.log(chalk.dim('Install a spec with: spectrl install <spec>'));
    return;
  }

  console.log(chalk.bold('\nInstalled specs:\n'));

  const table = new Table({
    head: [chalk.cyan('Spec'), chalk.cyan('Version'), chalk.cyan('Source')],
    colWidths: [30, 10, 12],
    style: {
      head: [],
      border: ['dim'],
    },
  });

  entries.forEach(([key, data]: [string, any]) => {
    const isPublic = data.source.startsWith('https://') || data.source.startsWith('http://');
    const source = isPublic ? chalk.blue('public') : chalk.green('local');

    // Parse spec name and version from key
    const [specName, version] = key.split('@');

    table.push([chalk.bold(specName), version || chalk.dim('unknown'), source]);
  });

  console.log(table.toString());
  console.log(chalk.dim(`\n${entries.length} spec${entries.length === 1 ? '' : 's'} installed\n`));
}
```

## CLI Structure

```
packages/cli/
  src/
    commands/
      login.ts           # New - Device Flow implementation
      logout.ts          # New
      whoami.ts          # New
      publish.ts         # Enhanced
      install.ts         # Enhanced
      search.ts          # New
      info.ts            # New
      list.ts            # Enhanced
    auth/
      token-manager.ts   # New
    utils/
      spec-ref.ts        # New (parse spec references)
      api-client.ts      # New (API wrapper)
```

**Dependencies:**

- `keytar` - OS keychain access for secure token storage
- `node-machine-id` - Machine ID for encryption fallback
- `open` - Open browser for device flow
- `inquirer` - Interactive prompts (publish destination, unpublish confirmation)
- `cli-table3` - Beautiful terminal tables
- `chalk` - Terminal colors and styling
- `date-fns` - Human-readable date formatting
- `semver` - Semantic version comparison for updates
- ~~`express`~~ - No longer needed!

## Environment Variables

```bash
# Production environment variables
API_URL=https://bpleokxqv5.execute-api.eu-north-1.amazonaws.com/prod
REGISTRY_URL=https://spectrl-registry-prod.s3.eu-north-1.amazonaws.com

# Development environment variables (LocalStack)
API_URL=http://localhost:4566/restapis/{api_id}/dev/_user_request_
REGISTRY_URL=http://localhost:4566/spectrl-registry-dev

# Note: REGISTRY_URL can be:
# - Direct S3 URL (current): https://spectrl-registry-prod.s3.eu-north-1.amazonaws.com
# - LocalStack S3 (dev): http://localhost:4566/spectrl-registry-dev
# - CloudFront CDN (future): https://d1234567890.cloudfront.net
# - Custom domain (future): https://registry.spectrl.dev (when domain is secured)

# Note: API_URL options:
# - API Gateway (current): https://bpleokxqv5.execute-api.eu-north-1.amazonaws.com/prod
# - LocalStack (dev): http://localhost:4566/restapis/{api_id}/dev/_user_request_
# - Custom domain (future): https://api.spectrl.dev (when domain is secured)
```

**Lambda Configuration:**

Lambdas retrieve GitHub OAuth credentials from AWS Secrets Manager (no environment variables needed for client_id/client_secret):

- Secret ARN passed via environment variable: `SECRETS_ARN`
- Client ID and secret retrieved at runtime using existing helper: `getGithubOAuthCredentials()`

## Development and Testing

### LocalStack for Development

Use LocalStack to develop and test the new Lambda endpoints locally before deploying to production.

**LocalStack URLs:**

```bash
# Development environment variables
API_URL=http://localhost:4566/restapis/{api_id}/dev/_user_request_
REGISTRY_URL=http://localhost:4566/spectrl-registry-dev

# Note: Get actual api_id after deploying to LocalStack
# Run: awslocal apigateway get-rest-apis
```

**Deploy to LocalStack:**

```bash
# Start LocalStack
docker-compose up -d

# Build Lambdas
cd api
pnpm build

# Deploy infrastructure
cd ../infra/environments/dev
tflocal apply

# Get API Gateway ID
awslocal apigateway get-rest-apis

# Test endpoints
curl -X POST http://localhost:4566/restapis/{api_id}/dev/_user_request_/auth/device/init
```

**LocalStack Testing Script:**

Update `infra/test-localstack.sh` to include device flow tests:

```bash
#!/bin/bash

# Test device flow init
echo "Testing device flow init..."
curl -X POST "$API_URL/auth/device/init"

# Test device flow poll (pending)
echo "Testing device flow poll..."
curl -X POST "$API_URL/auth/device/poll" \
  -H "Content-Type: application/json" \
  -d '{"device_code":"test_device_code"}'

# ... existing tests ...
```

### Development Workflow

1. **Make changes** to Lambda code in `api/auth-device-init/` or `api/auth-device-poll/`
2. **Build**: `cd api && pnpm build`
3. **Deploy to LocalStack**: `cd infra/environments/dev && tflocal apply`
4. **Test**: `cd infra && ./test-localstack.sh`
5. **Iterate** until tests pass
6. **Deploy to production**: `cd infra/environments/prod && terraform apply`

## Testing Strategy

### Unit Tests

- TokenManager (keychain and fallback)
- Spec reference parser
- API client functions
- Command logic (with mocked API calls)

### Integration Testing

**Device Flow:**

1. Test device flow initiation
2. Test polling mechanism
3. Test timeout handling
4. Test authorization denial
5. Test token storage after successful auth

**Commands:**

1. Test login flow end-to-end
2. Test publish to public
3. Test install from public
4. Test search functionality
5. Test info command
6. Test logout flow

**Platform Testing:**

- Test on macOS (Keychain)
- Test on Linux (Secret Service)
- Test on Windows (Credential Manager) if available
- Test fallback encryption on all platforms

### Lambda Testing

**New Lambdas:**

- Unit test device flow init Lambda
- Unit test device flow poll Lambda
- Integration test with GitHub Device Flow API
- Test error cases (expired codes, denied authorization)

## Documentation and Recipes

### CLI Documentation Structure

```
packages/cli/
  README.md           # Main documentation
  docs/
    RECIPES.md        # Step-by-step guides
```

### Recipe Examples

**Recipe 1: Publishing your first spec**

````markdown
# Publishing Your First Spec

This guide walks you through publishing a spec to the public registry.

## Prerequisites

- GitHub account
- Spectrl CLI installed

## Steps

1. **Create a spec**
   ```bash
   mkdir my-api-spec
   cd my-api-spec
   spectrl init
   ```
````

2. **Edit your spec files**
   Add your content to the spec files...

3. **Login to Spectrl**

   ```bash
   spectrl login
   # Opens browser, enter code, authorize
   ```

4. **Publish to public registry**

   ```bash
   spectrl publish
   # Select "Public registry"
   ```

5. **Verify publication**
   ```bash
   spectrl search my-api-spec
   spectrl info yourusername/my-api-spec
   ```

## What happens when you publish?

- Spec is uploaded to S3
- Metadata stored in DynamoDB
- Becomes searchable and installable by others

````

**Recipe 2: Finding and installing specs**
```markdown
# Finding and Installing Specs

## Search for specs
```bash
# Search by keyword
spectrl search api

# Search by tag
spectrl search graphql
````

## View spec details

```bash
spectrl info alice/api-spec
# Shows all versions, tags, description
```

## Install a spec

```bash
# Install latest version
spectrl install alice/api-spec

# Install specific version
spectrl install alice/api-spec@2.1.0
```

## List installed specs

```bash
spectrl list
# Shows all installed specs (local and public)
```

````

**Recipe 3: Keeping specs up to date**
```markdown
# Keeping Specs Up to Date

## Check for updates
```bash
spectrl update
# Shows table of available updates
````

## Update a specific spec

```bash
spectrl update alice/api-spec
```

## Update all specs

```bash
spectrl update --all
```

## What gets updated?

- Only public specs are checked for updates
- Local specs are not affected
- Semantic versioning is respected

````

**Recipe 4: Managing published specs**
```markdown
# Managing Published Specs

## View your published specs
```bash
spectrl search yourusername
````

## Update a published spec

1. Make changes locally
2. Update version in spectrl.json
3. Publish again:
   ```bash
   spectrl publish
   # Select "Public registry"
   ```

## Remove a published spec

```bash
spectrl unpublish yourusername/my-spec@1.0.0
# Requires confirmation
```

⚠️ **Warning:** Unpublishing is permanent and cannot be undone!

````

**Recipe 5: Working with local and public specs**
```markdown
# Working with Local and Public Specs

## When to use local vs public

**Local specs:**
- Private/internal specs
- Work in progress
- Company-specific templates

**Public specs:**
- Open source templates
- Community contributions
- Reusable across projects

## Publishing to local registry
```bash
spectrl publish
# Select "Local registry"
````

## Installing from local registry

```bash
spectrl install my-local-spec
# No username prefix = local
```

## Mixing local and public

You can have both installed in the same project:

```bash
spectrl list
# Shows:
# alice/api-spec (public)
# my-internal-spec (local)
```

```

## Troubleshooting

### Device Flow Not Working

**Symptom:** Login fails with "bad_verification_code" or 401 errors

**Cause:** Device Flow not enabled on GitHub OAuth App

**Solution:**
1. Go to GitHub OAuth App settings
2. Enable "Device Flow" checkbox
3. Save and retry

### "Invalid client_id" Error

**Symptom:** Device flow init returns invalid client_id

**Cause:** Client ID in Secrets Manager doesn't match GitHub OAuth App

**Solution:**
1. Verify client_id in AWS Secrets Manager
2. Compare with GitHub OAuth App client ID
3. Update Secrets Manager if needed

### Token Not Persisting

**Symptom:** User has to login every time

**Cause:** TokenManager not storing token correctly

**Solution:**
1. Check if keytar is installed: `npm list keytar`
2. Check file permissions on `~/.spectrl/.auth`
3. Test token storage manually

### "Spec not found" After Publishing

**Symptom:** Just published spec doesn't appear in search

**Cause:** DynamoDB eventual consistency or indexing delay

**Solution:**
- Wait a few seconds and try again
- Check DynamoDB directly to verify spec was stored
- Check CloudWatch logs for publish Lambda errors

## Next Steps (Phase 4)

Once CLI is validated:

- Build website for discovery
- Create landing page
- Build spec index/browse pages
- Write documentation
```
