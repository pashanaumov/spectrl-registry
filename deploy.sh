#!/bin/bash
set -e

echo "🚀 Deploying spectrl-registry API..."

# Build
cd api
bash build-functions.sh

# Deploy to Cloud Run
cd dist/server
gcloud run deploy spectrl-api \
  --source . \
  --region europe-west1 \
  --project spectrl-registry \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=spectrl-registry,BUCKET_NAME=spectrl-specs-prod,GITHUB_CLIENT_ID_SECRET=github-oauth-client-id,GITHUB_CLIENT_SECRET_SECRET=github-oauth-client-secret" \
  --service-account spectrl-api-sa@spectrl-registry.iam.gserviceaccount.com \
  --min-instances 0 \
  --max-instances 10 \
  --quiet

echo "✅ Deployed to https://api.spectrl.pro"
