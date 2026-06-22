#!/bin/bash
set -e

echo "🔨 Building Lambda code..."
cd ../../../api
./build-lambdas.sh

echo ""
echo "🚀 Deploying to LocalStack..."
cd ../infra/environments/dev
tflocal apply -auto-approve

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Lambda functions:"
tflocal output -json | jq -r 'to_entries[] | select(.key | endswith("_function_name")) | "  - \(.value.value)"'
