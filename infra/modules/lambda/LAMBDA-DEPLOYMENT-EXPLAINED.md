# Lambda Deployment Deep Dive

This document explains how Lambda functions are built, packaged, deployed, and configured in our infrastructure.

---

## Table of Contents

1. [How Code Gets Zipped and Sent to AWS](#how-code-gets-zipped-and-sent-to-aws)
2. [How Environment Variables Get Injected](#how-environment-variables-get-injected)
3. [OAuth Flow and Lambda Timeouts](#oauth-flow-and-lambda-timeouts)

---

## How Code Gets Zipped and Sent to AWS

### The Complete Journey: TypeScript → ZIP → Lambda

#### Step 1: Build Process (`api/build-lambdas.sh`)

```bash
#!/bin/bash
set -e

# 1. Compile TypeScript to JavaScript
pnpm build  # Runs: tsc

# 2. Prepare each Lambda package
prepare_lambda() {
  local lambda_name=$1
  local dist_dir="dist/${lambda_name}"

  # Copy shared code
  cp -r dist/shared "${dist_dir}/"

  # Copy node_modules
  mkdir -p "${dist_dir}/node_modules"
  for pkg in @aws-sdk zod; do
    cp -r node_modules/${pkg}/* "${dist_dir}/node_modules/${pkg}/"
  done
}

prepare_lambda "auth-exchange"
prepare_lambda "publish-spec"
```

**What this creates:**

```
api/dist/auth-exchange/
├── index.js                    ← Our compiled handler
├── helpers/
│   ├── credentials.js          ← Compiled helpers
│   └── dynamoDb.js
├── schemas/
│   ├── github.js               ← Compiled schemas
│   └── aws.js
├── shared/                     ← Copied from dist/shared/
│   └── github.js
└── node_modules/               ← Copied dependencies
    ├── @aws-sdk/
    │   ├── client-dynamodb/
    │   ├── client-secrets-manager/
    │   └── lib-dynamodb/
    └── zod/
```

**Why copy `shared/` and `node_modules/`?**

Lambda needs a **self-contained package**. When Lambda runs `require('../shared/github')`, it needs to find that file in the package.

---

#### Step 2: Terraform Archives the Code

```hcl
data "archive_file" "auth_exchange" {
  type        = "zip"
  source_dir  = "${var.lambda_source_dir}/auth-exchange"
  output_path = "${path.module}/builds/auth-exchange.zip"
  excludes    = ["*.map", "*.d.ts"]
}
```

**What Terraform does:**

1. **Reads the source directory**

   ```
   /path/to/api/dist/auth-exchange/
   ```

2. **Creates a ZIP file** at:

   ```
   /path/to/infra/modules/lambda/builds/auth-exchange.zip
   ```

3. **Excludes unnecessary files**:
   - `*.map` - Source maps (only for debugging TypeScript)
   - `*.d.ts` - TypeScript type definitions (not needed at runtime)

**The ZIP structure:**

```
auth-exchange.zip
├── index.js
├── helpers/
│   ├── credentials.js
│   └── dynamoDb.js
├── schemas/
│   ├── github.js
│   └── aws.js
├── shared/
│   └── github.js
└── node_modules/
    ├── @aws-sdk/
    └── zod/
```

**Why ZIP?**

Lambda requires code to be uploaded as a ZIP file. This is AWS's standard format for Lambda deployments.

---

#### Step 3: Terraform Calculates the Hash

```hcl
source_code_hash = data.archive_file.auth_exchange.output_base64sha256
```

**What this does:**

1. Terraform reads the ZIP file
2. Calculates SHA-256 hash of the entire ZIP
3. Encodes it as base64

**Example:**

```
ZIP contents → SHA-256 → base64
auth-exchange.zip → a1b2c3d4e5f6... → YTFiMmMzZDRlNWY2...
```

**Why?**

This hash tells Terraform when the code has changed:

```
First deploy:
  Hash: YTFiMmMzZDRlNWY2...
  Action: Upload ZIP to Lambda

Code changes:
  Hash: ZGVmNDU2Nzg5MGFi...  (different!)
  Action: Upload new ZIP to Lambda

No code changes:
  Hash: YTFiMmMzZDRlNWY2...  (same)
  Action: Skip upload (no changes)
```

---

#### Step 4: Terraform Uploads to Lambda

```hcl
resource "aws_lambda_function" "auth_exchange" {
  filename         = data.archive_file.auth_exchange.output_path
  source_code_hash = data.archive_file.auth_exchange.output_base64sha256
  // ...
}
```

**What happens during `terraform apply`:**

1. **Terraform reads the ZIP file**

   ```
   File: infra/modules/lambda/builds/auth-exchange.zip
   Size: ~15MB (with node_modules)
   ```

2. **Terraform calls AWS Lambda API**

   ```
   POST /2015-03-31/functions
   {
     "FunctionName": "spectrl-auth-exchange-dev",
     "Runtime": "nodejs20.x",
     "Role": "arn:aws:iam::...:role/spectrl-auth-exchange-dev",
     "Handler": "index.handler",
     "Code": {
       "ZipFile": <base64-encoded ZIP contents>
     }
   }
   ```

3. **AWS Lambda receives and stores the ZIP**
   - Extracts the ZIP
   - Stores the files in Lambda's internal storage
   - Prepares the execution environment

4. **Lambda is ready to run**

---

#### Step 5: What Lambda Does With the ZIP

When Lambda receives the ZIP, it:

1. **Extracts it to a temporary directory**

   ```
   /var/task/
   ├── index.js
   ├── helpers/
   ├── schemas/
   ├── shared/
   └── node_modules/
   ```

2. **Sets up the Node.js environment**

   ```javascript
   // Lambda's internal setup (simplified)
   process.chdir('/var/task');
   const handler = require('./index').handler;
   ```

3. **Keeps it warm for reuse**
   - First invocation: Cold start (~1-2 seconds to extract and load)
   - Subsequent invocations: Warm start (~10-50ms, reuses the extracted code)

---

### The Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Developer writes TypeScript                              │
│    api/auth-exchange/index.ts                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Build script compiles and bundles                        │
│    $ ./build-lambdas.sh                                     │
│    → Compiles TS to JS                                      │
│    → Copies shared/ and node_modules/                       │
│    Result: api/dist/auth-exchange/ (complete package)       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Terraform archives the code                              │
│    data "archive_file" "auth_exchange"                      │
│    → Reads api/dist/auth-exchange/                          │
│    → Creates auth-exchange.zip                              │
│    → Calculates SHA-256 hash                                │
│    Result: infra/modules/lambda/builds/auth-exchange.zip    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Terraform uploads to AWS                                 │
│    $ terraform apply                                        │
│    → Reads the ZIP file                                     │
│    → Calls AWS Lambda CreateFunction API                    │
│    → Sends ZIP as base64-encoded payload                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. AWS Lambda stores and prepares                           │
│    → Extracts ZIP to /var/task/                             │
│    → Sets up Node.js runtime                                │
│    → Loads index.js and caches it                           │
│    → Ready to handle requests                               │
└─────────────────────────────────────────────────────────────┘
```

---

## How Environment Variables Get Injected

### The Environment Variable Journey

#### Step 1: Defined in Terraform

```hcl
resource "aws_lambda_function" "auth_exchange" {
  // ...

  environment {
    variables = {
      AWS_REGION  = "eu-north-1"
      SECRETS_ARN = "arn:aws:secretsmanager:eu-north-1:000000000000:secret:spectrl/github-oauth-dev-YPJsFE"
      USERS_TABLE = "spectrl-users-dev"
    }
  }
}
```

**What Terraform does:**

When creating the Lambda, Terraform sends this to AWS:

```json
{
  "FunctionName": "spectrl-auth-exchange-dev",
  "Environment": {
    "Variables": {
      "AWS_REGION": "eu-north-1",
      "SECRETS_ARN": "arn:aws:secretsmanager:...",
      "USERS_TABLE": "spectrl-users-dev"
    }
  }
}
```

---

#### Step 2: AWS Stores the Variables

AWS Lambda stores these variables in its configuration database:

```
Lambda Function: spectrl-auth-exchange-dev
├─ Code: <ZIP file>
├─ Runtime: nodejs20.x
├─ Handler: index.handler
└─ Environment Variables:
   ├─ AWS_REGION = "eu-north-1"
   ├─ SECRETS_ARN = "arn:aws:secretsmanager:..."
   └─ USERS_TABLE = "spectrl-users-dev"
```

---

#### Step 3: Lambda Injects Variables at Runtime

When Lambda receives a request, **before** running your code:

```javascript
// Lambda's internal process (simplified)

// 1. Lambda reads the environment variables from its config
const envVars = {
  AWS_REGION: 'eu-north-1',
  SECRETS_ARN: 'arn:aws:secretsmanager:...',
  USERS_TABLE: 'spectrl-users-dev',
};

// 2. Lambda sets them in the Node.js process
process.env.AWS_REGION = envVars.AWS_REGION;
process.env.SECRETS_ARN = envVars.SECRETS_ARN;
process.env.USERS_TABLE = envVars.USERS_TABLE;

// 3. Lambda loads and runs your code
const handler = require('./index').handler;
const result = await handler(event, context);
```

---

#### Step 4: Your Code Reads the Variables

```typescript
// api/auth-exchange/helpers/credentials.ts

export async function getGithubOAuthCredentials() {
  const secretsManager = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? defaultAWSRegion,
    //     ^^^^^^^^^^^^^^^^^^^^^^
    //     This is now "eu-north-1" (injected by Lambda)
  });

  const command = new GetSecretValueCommand({
    SecretId: process.env.SECRETS_ARN,
    //        ^^^^^^^^^^^^^^^^^^^^^^^^
    //        This is now "arn:aws:secretsmanager:..." (injected by Lambda)
  });

  // ...
}
```

**What `process.env` is:**

`process.env` is a Node.js global object that contains environment variables. It's like a dictionary:

```javascript
process.env = {
  AWS_REGION: 'eu-north-1',
  SECRETS_ARN: 'arn:aws:secretsmanager:...',
  USERS_TABLE: 'spectrl-users-dev',
  PATH: '/usr/local/bin:/usr/bin:/bin', // System variables
  HOME: '/home/sbx_user1051', // System variables
  // ... many more
};
```

---

### How It Works Under the Hood

#### In a Regular Node.js Process

When you run Node.js locally:

```bash
$ AWS_REGION=us-east-1 USERS_TABLE=my-table node index.js
```

The shell sets environment variables, then Node.js reads them:

```javascript
// Your code
console.log(process.env.AWS_REGION); // "us-east-1"
console.log(process.env.USERS_TABLE); // "my-table"
```

#### In Lambda

Lambda does the same thing, but **automatically**:

```
1. Lambda starts a Node.js process
2. Lambda sets environment variables (from Terraform config)
3. Lambda loads your code
4. Your code reads process.env
```

---

### The Complete Environment Variable Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Developer defines in Terraform                           │
│    environment {                                            │
│      variables = {                                          │
│        USERS_TABLE = "spectrl-users-dev"                    │
│      }                                                       │
│    }                                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Terraform sends to AWS                                   │
│    POST /2015-03-31/functions                               │
│    {                                                         │
│      "Environment": {                                        │
│        "Variables": {                                        │
│          "USERS_TABLE": "spectrl-users-dev"                 │
│        }                                                     │
│      }                                                       │
│    }                                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. AWS stores in Lambda configuration                       │
│    Lambda Config Database:                                  │
│    {                                                         │
│      "FunctionName": "spectrl-auth-exchange-dev",           │
│      "Environment": {                                        │
│        "Variables": {                                        │
│          "USERS_TABLE": "spectrl-users-dev"                 │
│        }                                                     │
│      }                                                       │
│    }                                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Request arrives → Lambda starts execution                │
│    Lambda Runtime:                                          │
│    1. Read environment variables from config                │
│    2. Start Node.js process                                 │
│    3. Set process.env.USERS_TABLE = "spectrl-users-dev"    │
│    4. Load /var/task/index.js                               │
│    5. Call handler(event, context)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Your code reads the variable                             │
│    const tableName = process.env.USERS_TABLE;               │
│    // tableName is now "spectrl-users-dev"                  │
│                                                              │
│    const command = new PutCommand({                         │
│      TableName: tableName,  // Uses the injected value      │
│      Item: { ... }                                          │
│    });                                                       │
└─────────────────────────────────────────────────────────────┘
```

---

### Why This Approach?

#### 1. Security

Environment variables are **not in the code**:

```typescript
// ❌ Bad: Hardcoded (visible in code, in Git, everywhere)
const tableName = 'spectrl-users-dev';

// ✅ Good: From environment (not in code, not in Git)
const tableName = process.env.USERS_TABLE;
```

#### 2. Flexibility

Same code works in different environments:

```typescript
// Same code
const tableName = process.env.USERS_TABLE;

// Dev Lambda:    USERS_TABLE = "spectrl-users-dev"
// Prod Lambda:   USERS_TABLE = "spectrl-users-prod"
// Local testing: USERS_TABLE = "spectrl-users-local"
```

#### 3. Configuration Management

Change configuration without changing code:

```bash
# Update environment variable
$ terraform apply

# Lambda automatically uses new value on next invocation
# No code changes, no redeployment needed
```

---

### Testing Locally

You can simulate Lambda's environment locally:

```bash
# Set environment variables
export AWS_REGION=eu-north-1
export SECRETS_ARN=arn:aws:secretsmanager:...
export USERS_TABLE=spectrl-users-dev

# Run your code
node api/dist/auth-exchange/index.js
```

Or use a `.env` file with a tool like `dotenv`:

```bash
# .env
AWS_REGION=eu-north-1
SECRETS_ARN=arn:aws:secretsmanager:...
USERS_TABLE=spectrl-users-dev
```

```typescript
// Load .env file
import dotenv from 'dotenv';
dotenv.config();

// Now process.env has the values
console.log(process.env.USERS_TABLE); // "spectrl-users-dev"
```

---

## OAuth Flow and Lambda Timeouts

### Understanding the 30-Second Timeout

The 30-second timeout is **NOT** for the user's login process. Here's what actually happens:

### The Complete OAuth Flow

```
1. CLI starts OAuth flow
   ↓
2. CLI opens browser to GitHub
   ↓
3. User logs in (takes 5 minutes with 2FA? No problem!)
   ↓
4. User authorizes the app
   ↓
5. GitHub redirects to callback URL with a CODE
   ↓
6. CLI receives the code
   ↓
7. CLI calls our Lambda with the code ← THIS is the 30-second operation
   ↓
8. Lambda exchanges code for token (GitHub API call)
   ↓
9. Lambda returns token to CLI
```

### What the Lambda Does (30 seconds is plenty)

The `auth-exchange` Lambda only does this:

```typescript
export async function handler(event) {
  // 1. Parse the code from request body (milliseconds)
  const { code } = JSON.parse(event.body);

  // 2. Get OAuth credentials from Secrets Manager (100-200ms)
  const { clientId, clientSecret } = await getGithubOAuthCredentials();

  // 3. Exchange code for token with GitHub (200-500ms)
  const accessToken = await exchangeCodeForToken({ clientId, clientSecret, code });

  // 4. Get user info from GitHub (200-500ms)
  const user = await getGitHubUser(accessToken);

  // 5. Store user in DynamoDB (100-200ms)
  await storeUser(user);

  // 6. Return token (milliseconds)
  return { statusCode: 200, body: JSON.stringify({ token, username }) };
}
```

**Total time: ~1-2 seconds** (well under the 30-second timeout)

### The User's Experience

```
Terminal:
$ spectrl login

Opening browser for GitHub authentication...
Waiting for authorization...

[Browser opens]
```

```
Browser:
GitHub Login Page
├─ Enter username/password (user takes 30 seconds)
├─ Enter 2FA code (user takes another 30 seconds)
├─ Review permissions (user takes 10 seconds)
└─ Click "Authorize" button

→ Redirects to: http://localhost:3000/auth/callback?code=abc123xyz
```

```
Terminal (CLI receives the code):
Exchanging authorization code for access token...

[CLI calls Lambda with code=abc123xyz]
[Lambda runs for 1-2 seconds]
[Lambda returns token]

✓ Successfully logged in as username!
Token saved to keychain.
```

### Why This Works

The **user's login time doesn't count against the Lambda timeout** because:

1. **User logs in on GitHub's website** (GitHub's servers, not our Lambda)
2. **GitHub generates a code** (happens on GitHub's side)
3. **Only then** does the CLI call our Lambda with the code
4. **Lambda just exchanges the code** (quick API call)

### The OAuth Code

The "code" that GitHub gives us is:

- **Short-lived** (expires in ~10 minutes)
- **Single-use** (can only be exchanged once)
- **Not the actual token** (just a temporary authorization code)

This is why it's called "authorization code flow" - the code is just a temporary credential that we exchange for the real token.

### Why 30 Seconds is Enough

For the `auth-exchange` Lambda, 30 seconds is actually **generous**. The operations are:

- **Secrets Manager read**: ~100ms
- **GitHub API call 1** (exchange code): ~300ms
- **GitHub API call 2** (get user): ~300ms
- **DynamoDB write**: ~100ms
- **Total**: ~800ms

Even with network issues or slow responses, 30 seconds gives us a **37x safety margin**.

### When Would We Need More Time?

You'd need a longer timeout if the Lambda was:

- Processing large files (our `publish-spec` has 60s for this reason)
- Doing complex computations
- Calling many external APIs in sequence
- Waiting for something (which you should avoid in Lambda)

But for a simple "exchange code for token" operation, 30 seconds is more than enough.

### The Key Insight

**Lambda timeout ≠ User wait time**

The user can take as long as they want to log in. The Lambda only runs **after** they've completed the login and GitHub has generated the authorization code.

---

## Summary

### Zipping and Uploading

1. Build script creates complete package with dependencies
2. Terraform archives it into a ZIP file
3. Terraform calculates hash to detect changes
4. Terraform uploads ZIP to AWS Lambda via API
5. Lambda extracts and caches the code

### Environment Variables

1. Defined in Terraform configuration
2. Sent to AWS when creating/updating Lambda
3. Stored in Lambda's configuration
4. Injected into `process.env` before running code
5. Your code reads them via `process.env.VARIABLE_NAME`

### OAuth and Timeouts

1. User login happens on GitHub (not in Lambda)
2. Lambda only exchanges the authorization code
3. This takes ~1-2 seconds (well under 30s timeout)
4. User can take as long as needed to log in

Both the deployment and configuration processes happen automatically when you run `terraform apply`!
