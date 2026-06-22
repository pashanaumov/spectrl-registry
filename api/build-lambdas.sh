#!/bin/bash
set -e

echo "Building Lambda packages with esbuild..."

# Clean dist directory
rm -rf dist
mkdir -p dist

# Lambda functions to build
LAMBDAS=(
  "auth-exchange"
  "publish-spec"
  "search-specs"
  "get-spec"
  "unpublish-spec"
  "auth-device-init"
  "auth-device-poll"
  "track-download"
)

# Build each Lambda with esbuild
for lambda in "${LAMBDAS[@]}"; do
  echo "Building ${lambda}..."
  
  npx esbuild "${lambda}/index.ts" \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile="dist/${lambda}/index.js" \
    --external:@aws-sdk/* \
    --format=cjs \
    --minify
  
  echo "✓ ${lambda} built successfully"
done

echo ""
echo "✓ All Lambda functions built successfully!"
