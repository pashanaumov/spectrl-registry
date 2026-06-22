#!/bin/bash
set -e

echo "📦 Spectrl NPM Publication"
echo "=========================="
echo ""
echo "This will:"
echo "  1. Build all packages"
echo "  2. Run tests"
echo "  3. Publish @spectrl/cli to npm"
echo ""
echo "⚠️  WARNING: This publishes to PUBLIC npm registry!"
echo ""
read -p "Have you tested everything with ./build-local.sh? (yes/no): " tested

if [ "$tested" != "yes" ]; then
  echo "❌ Please test locally first with ./build-local.sh"
  exit 1
fi

echo ""
read -p "Are you sure you want to publish to npm? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Publication cancelled."
  exit 0
fi

echo ""
echo "🧪 Step 1/4: Running tests..."
echo "=============================="
pnpm test

echo ""
echo "📦 Step 2/4: Building all packages..."
echo "======================================"
pnpm build

echo ""
echo "🔍 Step 3/4: Checking package versions..."
echo "=========================================="
echo ""
echo "Current versions:"
echo "  @spectrl/cli:    $(cd packages/cli && node -p "require('./package.json').version")"
echo ""
read -p "Do these versions look correct? (yes/no): " versions_ok

if [ "$versions_ok" != "yes" ]; then
  echo ""
  echo "💡 Update versions with:"
  echo "   cd packages/cli && pnpm version:patch"
  echo ""
  exit 1
fi

echo ""
echo "📤 Step 4/4: Publishing to npm..."
echo "=================================="

# Publish CLI (depends on core and schema)
echo ""
echo "Publishing @spectrl/cli..."
cd packages/cli
npm publish --access public

cd ../..

echo ""
echo "✅ All packages published successfully!"
echo ""
echo "📋 Published packages:"
echo "  ✓ @spectrl/schema"
echo "  ✓ @spectrl/core"
echo "  ✓ @spectrl/cli"
echo ""
echo "🌐 View on npm:"
echo "  https://www.npmjs.com/package/@spectrl/cli"
echo "  https://www.npmjs.com/package/@spectrl/core"
echo "  https://www.npmjs.com/package/@spectrl/schema"
echo ""
echo "💡 Users can now install with:"
echo "   npm install -g @spectrl/cli"
echo "   npx @spectrl/cli@latest --version"
echo ""
echo "🎉 Publication complete!"
echo ""
