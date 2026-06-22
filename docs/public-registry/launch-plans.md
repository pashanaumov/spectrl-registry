**Complete build plan: AWS to Launch**

---

# **Phase 1: AWS Infrastructure (Days 1-5)**

## **Day 1: S3 + CloudFront Setup**

### **Morning: S3 Bucket**

1. Create S3 bucket: `spectrl-registry-prod`
   - Region: us-east-1 (cheapest, closest to CloudFront)
   - Block public access: OFF (specs are public read)
   - Versioning: ON (safety net for accidental deletes)
   - Encryption: AES-256 (default)

2. Bucket structure:

   ```
   specs/
     {username}/
       {spec-name}/
         {version}/
           spectrl.json
           files/
             (all spec files)
   ```

3. Bucket policy (public read):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::spectrl-registry-prod/specs/*"
       }
     ]
   }
   ```

4. CORS configuration:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

### **Afternoon: CloudFront Distribution**

1. Create distribution:
   - Origin: S3 bucket
   - Viewer protocol: Redirect HTTP to HTTPS
   - Allowed methods: GET, HEAD, OPTIONS
   - Cache policy: CachingOptimized
   - Price class: Use all edge locations

2. Custom domain setup:
   - Buy domain: `spectrl.dev` (Namecheap/Route53)
   - Request SSL cert in ACM (us-east-1 region)
   - Add CNAME: `registry.spectrl.dev` → CloudFront distribution
   - Wait for DNS propagation (~10-30 min)

3. Test:

   ```bash
   # Upload test file
   aws s3 cp test.txt s3://spectrl-registry-prod/specs/test/test.txt

   # Verify via CloudFront
   curl https://registry.spectrl.dev/specs/test/test.txt
   ```

---

## **Day 2: DynamoDB Tables**

### **Morning: Create Tables**

1. **specs table:**

   ```
   Table name: spectrl-specs-prod
   Partition key: specId (String) - format: "username/spec-name"
   Sort key: version (String) - format: "1.0.0"

   Attributes:
   - specId (PK)
   - version (SK)
   - username (String)
   - specName (String)
   - description (String)
   - agentPurpose (String)
   - agentTags (List)
   - createdAt (String - ISO timestamp)
   - downloads (Number)
   - s3Path (String)
   - hash (String)

   GSI-1 (for search by username):
   - PK: username
   - SK: createdAt

   GSI-2 (for popular specs):
   - PK: "ALL" (literal string for all specs)
   - SK: downloads

   Billing: On-demand (pay per request)
   ```

2. **users table:**

   ```
   Table name: spectrl-users-prod
   Partition key: githubId (Number)

   Attributes:
   - githubId (PK)
   - username (String)
   - email (String)
   - createdAt (String)
   - lastLogin (String)

   GSI-1 (lookup by username):
   - PK: username

   Billing: On-demand
   ```

### **Afternoon: Test Tables**

```bash
# Test write
aws dynamodb put-item \
  --table-name spectrl-specs-prod \
  --item '{
    "specId": {"S": "testuser/test-spec"},
    "version": {"S": "1.0.0"},
    "username": {"S": "testuser"},
    "specName": {"S": "test-spec"},
    "description": {"S": "Test spec"},
    "createdAt": {"S": "2025-01-01T00:00:00Z"},
    "downloads": {"N": "0"}
  }'

# Test read
aws dynamodb get-item \
  --table-name spectrl-specs-prod \
  --key '{"specId": {"S": "testuser/test-spec"}, "version": {"S": "1.0.0"}}'
```

---

## **Day 3: GitHub OAuth App**

### **Morning: Register OAuth App**

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Settings:
   - Name: Spectrl CLI
   - Homepage: https://spectrl.dev
   - Description: Local-first spec registry
   - Callback URL: `http://localhost:3000/auth/callback`
   - Enable Device Flow: YES (for CLI)

4. Save credentials:
   - Client ID: `xxx`
   - Client Secret: `yyy`

### **Afternoon: Store in AWS Secrets Manager**

```bash
aws secretsmanager create-secret \
  --name spectrl/github-oauth \
  --secret-string '{
    "clientId": "your_client_id",
    "clientSecret": "your_client_secret"
  }' \
  --region us-east-1
```

---

## **Day 4-5: Lambda Functions + API Gateway**

### **Day 4 Morning: Lambda - Auth Exchange**

**Function: auth-exchange**

```typescript
// lambda/auth-exchange/index.ts
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

export async function handler(event: any) {
  const { code } = JSON.parse(event.body);

  // 1. Get GitHub OAuth credentials from Secrets Manager
  const secrets = await getSecrets();

  // 2. Exchange code for token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      code,
    }),
  });
  const { access_token } = await tokenResponse.json();

  // 3. Get user info from GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const user = await userResponse.json();

  // 4. Store/update user in DynamoDB
  await dynamodb.putItem({
    TableName: 'spectrl-users-prod',
    Item: {
      githubId: { N: user.id.toString() },
      username: { S: user.login },
      email: { S: user.email || '' },
      createdAt: { S: new Date().toISOString() },
      lastLogin: { S: new Date().toISOString() },
    },
  });

  // 5. Return token to CLI
  return {
    statusCode: 200,
    body: JSON.stringify({
      token: access_token,
      username: user.login,
    }),
  };
}
```

Deploy:

```bash
cd lambda/auth-exchange
npm install
zip -r function.zip .
aws lambda create-function \
  --function-name spectrl-auth-exchange \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30
```

### **Day 4 Afternoon: Lambda - Publish Spec**

**Function: publish-spec**

```typescript
// lambda/publish-spec/index.ts
import { S3 } from '@aws-sdk/client-s3';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import crypto from 'crypto';

export async function handler(event: any) {
  const token = event.headers.Authorization?.replace('Bearer ', '');
  const { manifest, files } = JSON.parse(event.body);

  // 1. Verify token with GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) {
    return { statusCode: 401, body: 'Invalid token' };
  }
  const user = await userResponse.json();

  // 2. Validate manifest
  if (!manifest.name || !manifest.version || !manifest.files) {
    return { statusCode: 400, body: 'Invalid manifest' };
  }

  // 3. Check namespace ownership (user can only publish to their namespace)
  const specId = `${user.login}/${manifest.name}`;

  // 4. Calculate content hash
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ manifest, files }))
    .digest('hex');

  // 5. Upload to S3
  const s3Path = `specs/${user.login}/${manifest.name}/${manifest.version}`;

  // Upload manifest
  await s3.putObject({
    Bucket: 'spectrl-registry-prod',
    Key: `${s3Path}/spectrl.json`,
    Body: JSON.stringify(manifest),
    ContentType: 'application/json',
  });

  // Upload each file
  for (const [path, content] of Object.entries(files)) {
    await s3.putObject({
      Bucket: 'spectrl-registry-prod',
      Key: `${s3Path}/files/${path}`,
      Body: content as string,
      ContentType: 'text/plain',
    });
  }

  // 6. Store metadata in DynamoDB
  await dynamodb.putItem({
    TableName: 'spectrl-specs-prod',
    Item: {
      specId: { S: specId },
      version: { S: manifest.version },
      username: { S: user.login },
      specName: { S: manifest.name },
      description: { S: manifest.description || '' },
      agentPurpose: { S: manifest.agent?.purpose || '' },
      agentTags: { L: (manifest.agent?.tags || []).map((t: string) => ({ S: t })) },
      createdAt: { S: new Date().toISOString() },
      downloads: { N: '0' },
      s3Path: { S: s3Path },
      hash: { S: `sha256:${hash}` },
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Published ${specId}@${manifest.version}`,
      url: `https://spectrl.dev/specs/${specId}`,
    }),
  };
}
```

Deploy similar to auth-exchange.

### **Day 5 Morning: Lambda - Search & Get Spec**

**Function: search-specs**

```typescript
// lambda/search-specs/index.ts
export async function handler(event: any) {
  const query = event.queryStringParameters?.q || '';

  // Scan DynamoDB (for MVP, no fancy search)
  const result = await dynamodb.scan({
    TableName: 'spectrl-specs-prod',
    FilterExpression: 'contains(specName, :q) OR contains(description, :q)',
    ExpressionAttributeValues: {
      ':q': { S: query.toLowerCase() },
    },
    Limit: 20,
  });

  const specs =
    result.Items?.map((item) => ({
      id: item.specId.S,
      version: item.version.S,
      description: item.description.S,
      downloads: parseInt(item.downloads.N || '0'),
    })) || [];

  return {
    statusCode: 200,
    body: JSON.stringify({ results: specs }),
  };
}
```

**Function: get-spec**

```typescript
// lambda/get-spec/index.ts
export async function handler(event: any) {
  const { username, specName } = event.pathParameters;
  const specId = `${username}/${specName}`;

  // Get all versions
  const result = await dynamodb.query({
    TableName: 'spectrl-specs-prod',
    KeyConditionExpression: 'specId = :id',
    ExpressionAttributeValues: {
      ':id': { S: specId },
    },
    ScanIndexForward: false, // newest first
  });

  const versions =
    result.Items?.map((item) => ({
      version: item.version.S,
      description: item.description.S,
      downloads: parseInt(item.downloads.N || '0'),
      createdAt: item.createdAt.S,
      s3Path: item.s3Path.S,
    })) || [];

  return {
    statusCode: 200,
    body: JSON.stringify({
      id: specId,
      versions,
    }),
  };
}
```

### **Day 5 Afternoon: API Gateway Setup**

1. Create REST API: `spectrl-api-prod`

2. Create resources & methods:

   ```
   POST /auth/exchange → lambda:auth-exchange
   POST /publish → lambda:publish-spec (requires auth)
   GET /search → lambda:search-specs
   GET /specs/{username}/{specName} → lambda:get-spec
   DELETE /specs/{username}/{specName}/{version} → lambda:unpublish-spec
   ```

3. Enable CORS on all endpoints:

   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
   Access-Control-Allow-Headers: Authorization, Content-Type
   ```

4. Deploy to stage: `prod`

5. Custom domain:
   - Create: `api.spectrl.dev`
   - Map to stage `prod`
   - Update Route53 CNAME

6. Test endpoints:
   ```bash
   curl https://api.spectrl.dev/search?q=nextjs
   ```

---

# **Phase 2: CLI Commands (Days 6-10)**

## **Day 6: Token Storage with Keytar**

### **Morning: Install & Setup**

```bash
cd spectrl-cli
npm install keytar
npm install --save-dev @types/keytar
```

### **Afternoon: Implement Token Manager**

```typescript
// src/auth/token-manager.ts
import keytar from 'keytar';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SERVICE = 'spectrl';
const ACCOUNT = 'github-token';

export class TokenManager {
  async store(token: string): Promise<void> {
    try {
      // Try OS keychain first
      await keytar.setPassword(SERVICE, ACCOUNT, token);
    } catch (error) {
      // Fallback to encrypted file
      this.storeEncrypted(token);
    }
  }

  async get(): Promise<string | null> {
    try {
      return await keytar.getPassword(SERVICE, ACCOUNT);
    } catch (error) {
      return this.getEncrypted();
    }
  }

  async delete(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE, ACCOUNT);
    } catch (error) {
      this.deleteEncrypted();
    }
  }

  private storeEncrypted(token: string): void {
    const configDir = path.join(os.homedir(), '.spectrl');
    const keyPath = path.join(configDir, '.auth');

    // Encrypt with machine ID
    const cipher = crypto.createCipher('aes-256-cbc', this.getMachineKey());
    const encrypted = cipher.update(token, 'utf8', 'hex') + cipher.final('hex');

    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(keyPath, encrypted, { mode: 0o600 });
  }

  private getEncrypted(): string | null {
    const keyPath = path.join(os.homedir(), '.spectrl', '.auth');
    if (!fs.existsSync(keyPath)) return null;

    const encrypted = fs.readFileSync(keyPath, 'utf8');
    const decipher = crypto.createDecipher('aes-256-cbc', this.getMachineKey());
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  }

  private deleteEncrypted(): void {
    const keyPath = path.join(os.homedir(), '.spectrl', '.auth');
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
  }

  private getMachineKey(): string {
    // Use machine-specific identifier
    return require('node-machine-id').machineIdSync();
  }
}
```

---

## **Day 7: Login Command**

```typescript
// src/commands/login.ts
import express from 'express';
import open from 'open';
import { TokenManager } from '../auth/token-manager';

const GITHUB_CLIENT_ID = 'your_client_id'; // From env var
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

export async function loginCommand() {
  const tokenManager = new TokenManager();

  // Start local server for OAuth callback
  const app = express();
  let server: any;

  const authPromise = new Promise<string>((resolve, reject) => {
    app.get('/auth/callback', async (req, res) => {
      const code = req.query.code as string;

      if (!code) {
        res.send('❌ Authentication failed');
        reject(new Error('No code received'));
        return;
      }

      try {
        // Exchange code for token via API
        const response = await fetch('https://api.spectrl.dev/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const { token, username } = await response.json();

        res.send(`✓ Logged in as ${username}. You can close this window.`);
        resolve(token);
        server.close();
      } catch (error) {
        res.send('❌ Authentication failed');
        reject(error);
        server.close();
      }
    });

    server = app.listen(3000);
  });

  // Open browser to GitHub OAuth
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user:email`;

  console.log('Opening browser for authentication...');
  await open(authUrl);

  // Wait for callback
  const token = await authPromise;

  // Store token
  await tokenManager.store(token);

  console.log('✓ Authentication successful');
}
```

---

## **Day 8: Publish to Public Registry**

```typescript
// src/commands/publish.ts
import inquirer from 'inquirer';
import { TokenManager } from '../auth/token-manager';
import { readManifest, validateManifest } from '../utils/manifest';
import { readSpecFiles } from '../utils/files';

export async function publishCommand() {
  const tokenManager = new TokenManager();

  // Read manifest
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
    // Existing local publish logic
    return publishLocal(manifest);
  }

  // Public publish - check auth
  const token = await tokenManager.get();
  if (!token) {
    console.error('⚠️  You need to login first. Run: spectrl login');
    process.exit(1);
  }

  // Read all spec files
  const files = await readSpecFiles(manifest.files);

  // Upload to API
  const response = await fetch('https://api.spectrl.dev/publish', {
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

---

## **Day 9: Install from Public Registry**

```typescript
// src/commands/install.ts
import { parseSpecRef } from '../utils/spec-ref';
import { downloadFromRegistry } from '../utils/registry';

export async function installCommand(specRef?: string) {
  if (!specRef) {
    // Existing logic: restore from index
    return restoreFromIndex();
  }

  // Parse spec reference
  const parsed = parseSpecRef(specRef);
  // parsed = { username: 'alice', name: 'my-spec', version: '1.0.0' }

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
  const metaResponse = await fetch(`https://api.spectrl.dev/specs/${username}/${name}`);
  const meta = await metaResponse.json();

  // Determine version (latest if not specified)
  const targetVersion = version || meta.versions[0].version;
  const versionMeta = meta.versions.find((v: any) => v.version === targetVersion);

  if (!versionMeta) {
    console.error(`❌ Version ${targetVersion} not found`);
    process.exit(1);
  }

  console.log(`Found version ${targetVersion}`);

  // Download manifest from S3/CloudFront
  const manifestUrl = `https://registry.spectrl.dev/${versionMeta.s3Path}/spectrl.json`;
  const manifestResponse = await fetch(manifestUrl);
  const manifest = await manifestResponse.json();

  // Download files
  const specDir = path.join('.spectrl', 'specs', `${username}-${name}@${targetVersion}`);
  fs.mkdirSync(specDir, { recursive: true });

  // Save manifest
  fs.writeFileSync(path.join(specDir, 'spectrl.json'), JSON.stringify(manifest, null, 2));

  // Download each file
  for (const file of manifest.files) {
    const fileUrl = `https://registry.spectrl.dev/${versionMeta.s3Path}/files/${file}`;
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

---

## **Day 10: Search, Info, List, Whoami**

```typescript
// src/commands/search.ts
export async function searchCommand(query: string) {
  const response = await fetch(`https://api.spectrl.dev/search?q=${encodeURIComponent(query)}`);
  const { results } = await response.json();

  if (results.length === 0) {
    console.log('No specs found');
    return;
  }

  console.log(`Found ${results.length} specs:\n`);
  results.forEach((spec: any) => {
    console.log(`${spec.id}@${spec.version}`);
    console.log(`  ${spec.description}`);
    console.log(`  ${spec.downloads} downloads\n`);
  });
}

// src/commands/info.ts
export async function infoCommand(specRef: string) {
  const { username, name } = parseSpecRef(specRef);

  const response = await fetch(`https://api.spectrl.dev/specs/${username}/${name}`);
  const spec = await response.json();

  console.log(`${spec.id}`);
  console.log(`\nVersions:`);
  spec.versions.forEach((v: any) => {
    console.log(`  ${v.version} - ${v.createdAt} (${v.downloads} downloads)`);
  });
  console.log(`\nInstall: spectrl install ${spec.id}`);
}

// src/commands/list.ts
export async function listCommand() {
  const index = readIndex(); // Read .spectrl/spectrl-index.json

  console.log('Installed specs:\n');
  Object.entries(index).forEach(([key, data]: [string, any]) => {
    const isPublic = data.source.startsWith('https://');
    const source = isPublic ? '(public)' : '(local)';
    console.log(`${key} ${source}`);
  });
}

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

---

# **Phase 3: Website (Days 11-17)**

## **Day 11-12: Landing Page**

### **Tech Stack**

- Next.js 14 (App Router)
- Tailwind CSS
- Deployed on Vercel

### **Setup**

```bash
npx create-next-app@latest spectrl-web --typescript --tailwind --app
cd spectrl-web
npm install
```

### **Page Structure** (`app/page.tsx`)

```tsx
// Hero Section
<section className="max-w-6xl mx-auto px-4 py-20">
  <h1 className="text-5xl font-bold mb-6">Install production-ready specs in seconds</h1>
  <p className="text-xl text-gray-600 mb-8">
    Local-first spec registry. Think npm for your documentation, architecture, and AI workflows.
  </p>

  {/* Install example */}
  <div className="bg-gray-900 text-green-400 p-6 rounded-lg font-mono">
    $ spectrl install alice/nextjs-saas-starter
    <br />✓ Installed alice/nextjs-saas-starter@1.0.0
  </div>

  <div className="mt-8 flex gap-4">
    <a href="/docs" className="btn-primary">
      Get Started
    </a>
    <a href="/specs" className="btn-secondary">
      Browse Specs
    </a>
  </div>
</section>;

{
  /* Featured Specs */
}
<section className="bg-gray-50 py-20">
  <div className="max-w-6xl mx-auto px-4">
    <h2 className="text-3xl font-bold mb-12">Featured Specs</h2>
    <div className="grid md:grid-cols-3 gap-6">
      {featuredSpecs.map((spec) => (
        <div key={spec.id} className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-mono text-sm text-blue-600 mb-2">{spec.id}</h3>
          <p className="text-gray-600 mb-4">{spec.description}</p>
          <button className="text-sm text-blue-600">Install →</button>
        </div>
      ))}
    </div>
  </div>
</section>;

{
  /* How It Works */
}
<section className="max-w-6xl mx-auto px-4 py-20">
  <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
  <div className="grid md:grid-cols-3 gap-12">
    <div>
      <div className="text-4xl mb-4">1️⃣</div>
      <h3 className="font-bold mb-2">Create</h3>
      <p className="text-gray-600">Write specs for your architecture, workflows, or AI prompts</p>
    </div>
    <div>
      <div className="text-4xl mb-4">2️⃣</div>
      <h3 className="font-bold mb-2">Publish</h3>
      <p className="text-gray-600">Share with your team or the community in one command</p>
    </div>
    <div>
      <div className="text-4xl mb-4">3️⃣</div>
      <h3 className="font-bold mb-2">Install</h3>
      <p className="text-gray-600">Anyone can install and use your specs instantly</p>
    </div>
  </div>
</section>;

{
  /* AI-Native Callout */
}
<section className="bg-blue-50 py-20">
  <div className="max-w-4xl mx-auto px-4 text-center">
    <h2 className="text-3xl font-bold mb-4">AI-Native by Design</h2>
    <p className="text-xl text-gray-600 mb-8">
      Specs include structured metadata for AI agents. Control agent behavior, standardize prompts,
      and make your docs instantly readable by LLMs.
    </p>
    <a href="/docs/ai-native" className="btn-primary">
      Learn More
    </a>
  </div>
</section>;
```

### **Deploy to Vercel**

```bash
git init
git add .
git commit -m "Initial commit"
vercel deploy
```

---

## **Day 13-14: Public Index/Browse**

### **Page** (`app/specs/page.tsx`)

```tsx
'use client';
import { useState, useEffect } from 'react';

export default function SpecsPage() {
  const [specs, setSpecs] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    // Fetch all specs from API
    fetch('https://api.spectrl.dev/specs/all')
      .then(r => r.json())
      .then(data => setSpecs(data.specs));
  }, []);

  const filteredSpecs = specs
    .filter(s => s.name.includes(search) || s.description.includes(search))
    .filter(s => category === 'all' || s.category === category);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Spec Registry</h1>

      {/* Search & Filter */}
      <div className="mb-8 flex gap-4">
        <input
          type="text"
          placeholder="Search specs..."
          className="flex-1 px-4 py-2 border rounded"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="px-4 py-2 border rounded"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="scaffolding">Scaffolding</option>
          <option value="architecture">Architecture</option>
          <option value="testing">Testing</option>
          <option value="ai">AI/Agents</option>
          <option value="process">Process</option>
        </select>
      </div>

      {/* Spec Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSpecs.map(spec => (

            key={spec.id}
            href={`/specs/${spec.id}`}
            className="border rounded-lg p-6 hover:shadow-lg transition"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-mono text-sm text-blue-600">{spec.id}</h3>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                {spec.category}
              </span>
            </div>
            <p className="text-gray-600 mb-4">{spec.description}</p>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>v{spec.latestVersion}</span>
              <span>{spec.downloads} downloads</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
```

---

## **Day 15: Spec Detail Pages**

### **Page** (`app/specs/[username]/[name]/page.tsx`)

```tsx
export default async function SpecDetailPage({ params }: any) {
  const { username, name } = params;

  // Fetch spec metadata
  const response = await fetch(`https://api.spectrl.dev/specs/${username}/${name}`);
  const spec = await response.json();

  // Fetch README from S3
  const readmeUrl = `https://registry.spectrl.dev/${spec.versions[0].s3Path}/files/README.md`;
  const readmeResponse = await fetch(readmeUrl);
  const readme = await readmeResponse.text();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          {username}/{name}
        </h1>
        <p className="text-xl text-gray-600 mb-6">{spec.versions[0].description}</p>

        {/* Install Command */}
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono flex items-center justify-between">
          <span>
            $ spectrl install {username}/{name}
          </span>
          <button className="text-white">Copy</button>
        </div>
      </div>

      {/* Versions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Versions</h2>
        <select className="px-4 py-2 border rounded">
          {spec.versions.map((v: any) => (
            <option key={v.version} value={v.version}>
              {v.version} - {new Date(v.createdAt).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {/* README */}
      <div className="prose max-w-none">
        <ReactMarkdown>{readme}</ReactMarkdown>
      </div>
    </div>
  );
}
```

---

## **Day 16-17: Documentation Site**

### **Use Nextra** (Next.js + MDX docs framework)

```bash
npm install nextra nextra-theme-docs
```

### **Configure** (`next.config.js`)

```js
const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
});

module.exports = withNextra();
```

### **Docs Structure**

```
pages/
  docs/
    index.mdx           # Getting Started
    concepts.mdx        # Core Concepts
    cli/
      install.mdx       # CLI: install
      publish.mdx       # CLI: publish
      search.mdx        # CLI: search
    spec-format.mdx     # Spec Format
    ai-native.mdx       # AI-Native Features
    examples/
      multi-file.mdx
      dependencies.mdx
```

### **Sample Page** (`pages/docs/index.mdx`)

```mdx
# Getting Started

Install Spectrl CLI globally:

\`\`\`bash
npm install -g @spectrl/cli
\`\`\`

## Quick Start

### 1. Initialize a project

\`\`\`bash
cd your-project
spectrl init
\`\`\`

### 2. Install a spec

\`\`\`bash
spectrl install alice/nextjs-starter
\`\`\`

### 3. Publish your own

\`\`\`bash
spectrl login
cd my-spec
spectrl publish
\`\`\`

[Next: Core Concepts →](/docs/concepts)
```

---

# **Phase 4: Content Creation (Days 18-24)**

## **Day 18-19: Scaffolding Specs (10 specs)**

Create these specs with real, useful content:

1. **nextjs-saas-starter**
   - Files: README.md, architecture.md, setup-guide.md
   - Includes: Auth setup, DB schema, Stripe integration, deployment

2. **react-typescript-app**
   - Modern React + TypeScript + Vite setup
   - Component patterns, state management

3. **fastapi-backend**
   - FastAPI + SQLAlchemy + Alembic
   - API structure, auth, testing

4. **express-api**
   - Express + TypeScript + Prisma
   - REST API patterns

5. **rails-app**
   - Rails 7 setup
   - MVC patterns, ActiveRecord

6. **vue-starter**
   - Vue 3 + Composition API
   - Component architecture

7. **svelte-kit**
   - SvelteKit setup
   - Routing, stores

8. **django-rest**
   - Django + DRF
   - API patterns, serializers

9. **golang-api**
   - Go + Chi/Gin
   - Project structure

10. **rust-web-server**
    - Actix-web setup
    - Rust patterns

**Each spec should have:**

- Clear README with installation steps
- Architecture diagram (text/mermaid)
- Code examples
- Best practices
- Dependencies properly listed

---

## **Day 20: Architecture Specs (8 specs)**

1. **microservices-patterns**
   - Service boundaries
   - Communication patterns
   - Data consistency

2. **monolith-design**
   - Modular monolith structure
   - Domain separation

3. **api-rest-design**
   - REST principles
   - URL design, status codes
   - Versioning strategies

4. **graphql-schema**
   - Schema design
   - Resolvers, dataloaders
   - Performance

5. **event-driven-arch**
   - Event sourcing
   - CQRS
   - Message brokers

6. **cqrs-pattern**
   - Command/query separation
   - Read/write models

7. **hexagonal-architecture**
   - Ports & adapters
   - Dependency inversion

8. **ddd-bounded-contexts**
   - Domain modeling
   - Context mapping
   - Ubiquitous language

---

## **Day 21: Testing + AI Specs (11 specs)**

### **Testing (6):**

1. **test-strategy-template**
2. **e2e-playwright-setup**
3. **unit-test-patterns**
4. **integration-test-guide**
5. **api-testing-complete**
6. **tdd-workflow**

### **AI/Agent (5):**

1. **agent-safety-rules**

   ```markdown
   # Agent Safety Rules

   ## Before Making Changes

   - [ ] Confirm destructive operations (delete, overwrite, drop)
   - [ ] Show diff of what will change
   - [ ] Ask if uncertain about user intent

   ## When Debugging

   - [ ] Gather logs, stack traces, relevant code first
   - [ ] Don't assume root cause without evidence
   - [ ] Present hypothesis with confidence level

   ## Communication

   - [ ] Be clear and concise
   - [ ] Explain reasoning when asked
   - [ ] Admit when uncertain
   ```

2. **agent-code-review**
3. **agent-debugging-workflow**
4. **rag-setup-pattern**
5. **prompt-engineering-guide**

---

## **Day 22-23: Book/Best Practice Specs (16 specs)**

### **Book Templates (8):**

1. **ddd-bounded-contexts**
2. **solid-principles**
3. **clean-architecture**
4. **12-factor-app**
5. **refactoring-patterns**
6. **design-patterns-gof**
7. **pragmatic-programmer**
8. **effective-java** (language-agnostic patterns)

### **Best Practices (8):**

1. **api-design-best-practices**
2. **security-checklist**
3. **database-schema-patterns**
4. **error-handling-guide**
5. **git-workflow-standards**
6. **code-review-checklist**
7. **logging-best-practices**
8. **performance-optimization**

---

## **Day 24: Process Templates (5 specs)**

1. **adr-template**

   ```markdown
   # ADR: [Title]

   ## Status

   [Proposed | Accepted | Deprecated | Superseded]

   ## Context

   What is the issue we're addressing?

   ## Decision

   What did we decide?

   ## Consequences

   Positive and negative outcomes.
   ```

2. **rfc-template**
3. **prd-template**
4. **incident-response-playbook**
5. **onboarding-checklist**

---

# **Phase 5: Testing & Polish (Days 25-35)**

## **Day 25-27: End-to-End Testing**

### **Test Plan:**

1. **Publish 20 specs to production**
   - Log in via CLI
   - Publish from different machines
   - Verify on web index

2. **Install specs on fresh machines**
   - Mac, Linux, Windows (WSL)
   - Test dependency resolution
   - Verify file integrity

3. **Search & discovery**
   - Search for various keywords
   - Check results quality
   - Test filters/sorting

4. **Edge cases**
   - Publish spec with same name/version (should fail)
   - Install non-existent spec (error handling)
   - Corrupt network requests (retry logic?)

---

## **Day 28-32: Beta Testing (Post-Holiday)**

### **Recruit 5-10 Beta Users:**

**Where to find:**

- Twitter (build in public audience)
- Dev communities (Indie Hackers, Reddit r/SideProject)
- Personal network

**What to test:**

1. Install CLI and use it
2. Publish at least 1 spec
3. Install 3-5 specs from registry
4. Browse website and docs

**Feedback form:**

- What was confusing?
- What broke?
- What feature would you want?
- Would you use this regularly?

**Fix critical issues:**

- Auth failures
- Publishing bugs
- Installation errors
- Unclear docs

---

## **Day 33-34: Polish**

### **Landing Page:**

- Record 2-min demo video (Loom):
  - Problem: scattered docs, hard to share specs
  - Solution: `spectrl install alice/nextjs-starter`
  - Show publishing flow
  - Show browsing registry
- Add video to hero section
- Get 2-3 testimonials from beta users
- Optimize performance (Lighthouse 90+)

### **Documentation:**

- Fill gaps found in beta testing
- Add troubleshooting section
- Create FAQ
- Add more examples

### **Monitoring & Analytics:**

- Set up Plausible Analytics (privacy-friendly)
- Set up UptimeRobot for API monitoring
- Set up Sentry for error tracking
- Create status page (optional)

---

## **Day 35: Final Checks**

### **Security Review:**

- No token leaks in logs
- Input validation on all endpoints
- Rate limiting works
- S3 permissions correct

### **Performance:**

- CloudFront caching works
- API responses < 500ms
- Website loads < 2s

### **Content:**

- All 40 specs published and tested
- README quality check
- No broken links

---

## **Day 36: Launch Prep**

### **Create Launch Assets:**

1. **Product Hunt post:**

   ```
   Title: Spectrl - Local-first spec registry for devs

   Tagline: Install production-ready specs in seconds. npm for your docs, architecture, and AI workflows.

   Description:
   Spectrl treats your PRDs, TDDs, architecture docs, and AI prompts as versioned, installable packages.

   - 🏠 Local-first: works offline, all data in your repo
   - 📦 40+ specs ready to use: Next.js starters, architecture patterns, testing guides
   - 🤖 AI-native: structured for LLM consumption
   - 🚀 One command: `spectrl install alice/nextjs-starter`

   Gallery:
   - Demo video (2 min)
   - Screenshot of CLI in action
   - Screenshot of web index
   - Screenshot of spec detail page
   ```

2. **Show HN post:**

   ```
   Title: Spectrl – npm for documentation and specs

   Hey HN! I built Spectrl, a local-first registry for treating docs as versioned packages.

   The problem: scattered PRDs, architecture docs, AI prompts. Hard to share, version, or reuse across projects.

   The solution: `spectrl install alice/nextjs-saas-starter` - installs specs like npm packages.

   - Local-first (works offline)
   - Public registry for community specs
   - AI-native (structured metadata for agents)
   - 40+ specs at launch

   Tech: Node.js CLI, AWS (S3/Lambda/DynamoDB), Next.js

   Would love feedback! [link]
   ```

3. **Twitter thread:**

   ```
   Thread (10 tweets):
   1. Launching Spectrl today 🚀

   A local-first spec registry. Think npm for your docs, architecture, and AI workflows.

   Install production-ready specs in one command:
   `spectrl install alice/nextjs-saas-starter`

   2. The problem I'm solving:

   PRDs, TDDs, architecture docs scattered everywhere.
   Hard to share with team. Hard to version. Hard to reuse across projects.

   3. Spectrl makes specs installable packages.

   Just like npm, but for documentation:
   - spectrl install <spec>
   - spectrl publish
   - spectrl search

   4. [Demo GIF of install]

   5. 40+ specs available at launch:
   - Next.js/React starters
   - Architecture patterns (microservices, DDD, CQRS)
   - Testing guides
   - AI agent behavior specs
   - Process templates (ADR, PRD, RFC)

   6. AI-native by design:

   Specs include structured metadata for LLM consumption.
   Control agent behavior, standardize prompts, make docs machine-readable.

   7. Local-first:

   Works offline. All data in your repo.
   Public registry optional (for sharing with community).

   8. [Screenshot of web index]

   Browse 40+ specs at spectrl.dev

   9. [Screenshot of spec detail page]

   Each spec has versions, README, install command.

   10. Try it:

   npm install -g @spectrl/cli
   spectrl install alice/nextjs-starter

   Free and open. Feedback welcome!

   spectrl.dev
   ```

# **Timeline Summary**

| Phase                | Days           | Key Deliverables                                          |
| -------------------- | -------------- | --------------------------------------------------------- |
| **AWS Infra**        | 1-5            | S3, CloudFront, DynamoDB, Lambda, API Gateway             |
| **CLI Commands**     | 6-10           | login, publish public, install public, search, info, list |
| **Website**          | 11-17          | Landing, index, detail pages, docs                        |
| **Content**          | 18-24          | 40 specs across 6 categories                              |
| **Holiday Break**    | Dec 20 - Jan 5 | Rest                                                      |
| **Testing & Polish** | 25-35          | E2E tests, beta, polish, monitoring                       |
| **Launch**           | 36-38          | Assets, soft launch, PH/HN                                |

**Total: ~38 days of work + 16 days holiday = Launch mid-Jan** ✅

---

# **Critical Success Factors**

1. **Don't skip testing** - Bugs at launch kill momentum
2. **Quality over quantity** - 30 great specs beats 50 mediocre ones
3. **Engage on launch day** - PH/HN success requires active participation
4. **Iterate quickly** - Fix issues within hours, not days
5. **Document everything** - Users will read docs before asking

---

**You've got this. Start tomorrow with Day 1 (S3 setup) and don't look back.** 🚀

Let me know when you hit roadblocks or want to discuss specifics!
