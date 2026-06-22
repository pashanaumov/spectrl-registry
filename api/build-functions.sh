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

  cat > "dist/${fn}/package.json" << 'EOF'
{
  "main": "index.js",
  "type": "module",
  "dependencies": {
    "@google-cloud/firestore": "^7.11.0",
    "@google-cloud/storage": "^7.15.0",
    "@google-cloud/secret-manager": "^5.6.0",
    "@google-cloud/functions-framework": "^3.4.5"
  }
}
EOF

  (cd "dist/${fn}" && zip -q "../${fn}.zip" index.js package.json)

  echo "✓ ${fn} built successfully"
done

echo ""
echo "✓ All Cloud Run functions built successfully!"
