#!/bin/bash
set -e

echo "📦 Spectrl Registry NPM Publication"
echo "====================================="
echo ""
echo "This will:"
echo "  1. Build the CLI"
echo "  2. Run tests"
echo "  3. Publish spectrl-registry to npm"
echo ""
echo "⚠️  WARNING: This publishes to PUBLIC npm registry!"
echo ""
read -p "Are you sure you want to publish to npm? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Publication cancelled."
  exit 0
fi

echo ""
echo "🧪 Step 1/3: Running tests..."
pnpm test

echo ""
echo "📦 Step 2/3: Building CLI..."
pnpm build:cli

echo ""
echo "Current version: $(cd packages/cli && node -p "require('./package.json').version")"
read -p "Does the version look correct? (yes/no): " versions_ok

if [ "$versions_ok" != "yes" ]; then
  echo ""
  echo "💡 Bump version with:"
  echo "   cd packages/cli && npm version patch   # or minor/major"
  exit 1
fi

echo ""
echo "📤 Step 3/3: Publishing to npm..."
read -p "Enter your npm OTP code: " otp

cd packages/cli
npm publish --access public --otp "$otp"

echo ""
echo "✅ Published spectrl-registry@$(node -p "require('./package.json').version") to npm!"
echo ""
echo "🌐 https://www.npmjs.com/package/spectrl-registry"
echo ""
echo "💡 Users can now run:"
echo "   npx spectrl-registry@latest"
echo "   # or install globally: npm install -g spectrl-registry"
echo "   # binary: spr"
