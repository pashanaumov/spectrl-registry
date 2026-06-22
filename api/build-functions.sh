#!/bin/bash
set -e

echo "Building spectrl-registry API server..."

rm -rf dist
mkdir -p dist/server

npx esbuild server.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --outfile=dist/server/index.js \
  --external:@google-cloud/firestore \
  --external:@google-cloud/storage \
  --external:@google-cloud/secret-manager \
  --minify

cat > dist/server/package.json << 'EOF'
{
  "main": "index.js",
  "type": "module",
  "dependencies": {
    "@google-cloud/firestore": "^7.11.0",
    "@google-cloud/storage": "^7.15.0",
    "@google-cloud/secret-manager": "^5.6.0"
  }
}
EOF

(cd dist/server && zip -q ../server.zip index.js package.json)

echo "✓ Server built: dist/server.zip ($(du -sh dist/server.zip | cut -f1))"
