#!/bin/bash
set -e

echo "🔨 Building Lambda code..."
cd ../../../api
./build-lambdas.sh

echo ""
echo "🚀 Deploying to AWS (Production)..."
echo "⚠️  WARNING: This will deploy to REAL AWS!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled."
  exit 0
fi

cd ../infra/environments/prod
terraform apply

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Lambda functions:"
terraform output -json | jq -r 'to_entries[] | select(.key | endswith("_function_name")) | "  - \(.value.value)"'
