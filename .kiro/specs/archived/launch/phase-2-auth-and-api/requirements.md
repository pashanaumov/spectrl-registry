# Phase 2: Authentication & API - Requirements

## Overview

Build the API layer that handles GitHub OAuth authentication and spec operations (publish, search, retrieve).

## Goals

1. Enable users to authenticate via GitHub OAuth
2. Provide API endpoints for publishing specs
3. Provide API endpoints for searching and retrieving specs
4. Ensure secure, performant, and reliable API operations

## Functional Requirements

### FR-1: GitHub OAuth Authentication

- Users can authenticate using GitHub OAuth device flow
- CLI exchanges OAuth code for access token
- User data stored in DynamoDB on successful auth
- Token can be validated for subsequent requests

### FR-2: Publishing Specs

- Authenticated users can publish specs to public registry
- Namespace validation: users can only publish to their own namespace
- Spec files uploaded to S3 with correct structure
- Metadata stored in DynamoDB for search/discovery
- Content hash calculated and stored for integrity

### FR-3: Searching Specs

- Anyone can search specs without authentication
- Search by spec name, description, or tags
- Results include spec metadata (name, version, description, downloads)
- Results limited to prevent abuse

### FR-4: Retrieving Spec Metadata

- Anyone can get spec details without authentication
- Returns all versions of a spec
- Includes download counts, creation dates, S3 paths

### FR-5: Unpublishing Specs

- Authenticated users can unpublish their own specs
- Removes files from S3 and metadata from DynamoDB
- Only spec owner can unpublish

## Non-Functional Requirements

### NFR-1: Security

- All API endpoints use HTTPS
- OAuth credentials never exposed
- Token validation on protected endpoints
- Rate limiting to prevent abuse
- IAM roles follow least-privilege principle

### NFR-2: Performance

- API responses < 500ms for most operations
- Lambda cold starts < 1s
- Efficient DynamoDB queries

### NFR-3: Reliability

- Proper error handling and logging
- CloudWatch logs for debugging
- Graceful degradation on failures

### NFR-4: Cost Efficiency

- Lambda on-demand pricing (pay per request)
- API Gateway on-demand pricing
- No always-on servers

## Acceptance Criteria

### AC-1: GitHub OAuth Setup

- [ ] GitHub OAuth app registered
- [ ] Device flow enabled
- [ ] Credentials stored in Secrets Manager
- [ ] Can complete OAuth flow manually

### AC-2: Lambda Functions

- [ ] `auth-exchange` Lambda created and deployed
- [ ] `publish-spec` Lambda created and deployed
- [ ] `search-specs` Lambda created and deployed
- [ ] `get-spec` Lambda created and deployed
- [ ] `unpublish-spec` Lambda created and deployed
- [ ] All functions have proper IAM roles

### AC-3: API Gateway

- [ ] REST API created with all routes
- [ ] CORS configured on all endpoints
- [ ] Rate limiting configured
- [ ] Custom domain configured (or CloudFront domain works)
- [ ] All routes integrated with Lambda functions

### AC-4: End-to-End Testing

- [ ] Can complete OAuth flow via API
- [ ] Can publish spec via API with valid token
- [ ] Published spec appears in S3 and DynamoDB
- [ ] Can search for published spec
- [ ] Can retrieve spec metadata
- [ ] Can unpublish spec
- [ ] Unauthorized requests properly rejected

### AC-5: Documentation

- [ ] API endpoints documented
- [ ] Request/response formats documented
- [ ] Error codes documented
- [ ] Testing instructions provided

## Out of Scope

- CLI integration (Phase 3)
- Website (Phase 4)
- Advanced search features (semantic search, filters)
- User profiles or social features
- Email notifications
