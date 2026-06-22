#!/bin/bash
set -e

echo "Building Cloud Run function packages with esbuild..."

rm -rf dist
mkdir -p dist

FUNCTIONS=(
  "auth-device-init"
  "auth-device-poll"
  "auth-exchange"
  "get-spec"
  "publish-spec"
  "search-specs"
  "track-download"
  "unpublish-spec"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "Building ${fn}..."

  npx esbuild "${fn}/index.ts" \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=esm \
    --outfile="dist/${fn}/index.js" \
    --external:@google-cloud/firestore \
    --external:@google-cloud/storage \
    --external:@google-cloud/secret-manager \
    --external:@google-cloud/functions-framework \
    --minify

  echo '{"main":"index.js","type":"module"}' > "dist/${fn}/package.json"

  (cd "dist/${fn}" && zip -q "../${fn}.zip" index.js package.json)

  echo "✓ ${fn} built successfully"
done

echo ""
echo "✓ All Cloud Run functions built successfully!"
