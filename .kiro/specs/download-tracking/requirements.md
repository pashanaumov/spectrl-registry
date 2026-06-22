# Requirements Document

## Introduction

This document defines requirements for implementing download tracking in the Spectrl public registry. The feature will track when users install specs from the public registry and increment download counters stored in DynamoDB. The download count will be visible in CLI output and on the website, providing valuable metrics for spec popularity and usage.

## Glossary

- **CLI**: The spectrl command-line interface that users run to install specs
- **Public_Registry**: The remote registry hosted on AWS that stores published specs
- **DynamoDB**: AWS NoSQL database storing spec metadata including download counts
- **CloudFront**: AWS CDN serving spec files to users
- **Download_Event**: A single installation of a spec version by a user
- **Download_Counter**: The numeric field in DynamoDB tracking total downloads per spec version
- **Track_Download_API**: Backend API endpoint that increments the download counter
- **Installation_Session**: A single execution of `spectrl install` command
- **Local_Install**: Installing a spec from the local filesystem (not from public registry)

## Requirements

### Requirement 1: Track Public Registry Downloads

**User Story:** As a spec author, I want to see how many times my spec has been downloaded, so that I can measure its adoption and popularity.

#### Acceptance Criteria

1. WHEN a user installs a spec from the Public_Registry, THE CLI SHALL send a download tracking request to the Track_Download_API
2. THE Track_Download_API SHALL increment the Download_Counter in DynamoDB for the specific spec version
3. WHEN a user installs a spec from Local_Install, THE CLI SHALL NOT send a download tracking request
4. THE Track_Download_API SHALL accept the spec username, spec name, and version as parameters
5. THE Track_Download_API SHALL return success within 500ms under normal conditions

### Requirement 2: Non-Blocking Download Tracking

**User Story:** As a user, I want spec installation to succeed even if download tracking fails, so that temporary backend issues don't prevent me from working.

#### Acceptance Criteria

1. WHEN the Track_Download_API request fails, THE CLI SHALL continue the installation process without error
2. WHEN the Track_Download_API request times out after 3 seconds, THE CLI SHALL continue the installation process
3. THE CLI SHALL NOT wait for the Track_Download_API response before proceeding with file downloads
4. IF the Track_Download_API returns an error status code, THEN THE CLI SHALL log the error silently and continue
5. THE CLI SHALL send the tracking request asynchronously without blocking the installation workflow

### Requirement 3: Prevent Duplicate Counting

**User Story:** As a spec author, I want accurate download counts, so that I can trust the metrics for decision-making.

#### Acceptance Criteria

1. WHEN a user installs the same spec version multiple times in the same Installation_Session, THE CLI SHALL send only one tracking request
2. WHEN a user installs multiple different specs in the same Installation_Session, THE CLI SHALL send one tracking request per unique spec version
3. THE Track_Download_API SHALL use atomic increment operations to prevent race conditions
4. WHEN the CLI installs a spec that is already in the local cache, THE CLI SHALL NOT send a tracking request
5. THE CLI SHALL track downloads only when files are actually fetched from CloudFront

### Requirement 4: Display Download Counts

**User Story:** As a user, I want to see download counts when viewing spec information, so that I can assess spec popularity and community adoption.

#### Acceptance Criteria

1. WHEN a user runs `spectrl info username/spec`, THE CLI SHALL display the total downloads for each version
2. THE CLI SHALL format download counts with thousand separators for readability
3. WHEN a spec version has zero downloads, THE CLI SHALL display "0 downloads"
4. THE Website SHALL display download counts on spec detail pages
5. THE Website SHALL display total downloads across all versions on the spec overview page

### Requirement 5: API Endpoint Implementation

**User Story:** As a backend system, I need a dedicated API endpoint for tracking downloads, so that the CLI can report download events reliably.

#### Acceptance Criteria

1. THE Track_Download_API SHALL be implemented as an AWS Lambda function
2. THE Track_Download_API SHALL accept POST requests with JSON body containing username, specName, and version
3. THE Track_Download_API SHALL validate request parameters using Zod schemas
4. THE Track_Download_API SHALL return HTTP 200 on successful increment
5. IF the spec version does not exist in DynamoDB, THEN THE Track_Download_API SHALL return HTTP 404
6. THE Track_Download_API SHALL use DynamoDB UpdateItem with ADD operation for atomic increments
7. THE Track_Download_API SHALL require authentication using the same auth mechanism as other registry APIs

### Requirement 6: Download Count Persistence

**User Story:** As a system administrator, I want download counts to persist accurately in the database, so that metrics remain reliable over time.

#### Acceptance Criteria

1. THE DynamoDB table SHALL store the downloads field as a Number type
2. WHEN a new spec version is published, THE downloads field SHALL be initialized to 0
3. THE Track_Download_API SHALL increment the downloads field by exactly 1 per request
4. THE DynamoDB table SHALL use the existing partition key (specId) and sort key (version) structure
5. THE downloads field SHALL support values up to 2^53-1 (JavaScript safe integer limit)

### Requirement 7: Error Handling and Observability

**User Story:** As a system administrator, I want visibility into download tracking failures, so that I can monitor system health and debug issues.

#### Acceptance Criteria

1. WHEN the Track_Download_API fails to increment the counter, THE Lambda function SHALL log the error with context
2. THE Track_Download_API SHALL emit CloudWatch metrics for successful and failed tracking attempts
3. WHEN the CLI tracking request fails, THE CLI SHALL log the failure in debug mode only
4. THE Track_Download_API SHALL return descriptive error messages in the response body
5. IF DynamoDB is unavailable, THEN THE Track_Download_API SHALL return HTTP 503 Service Unavailable

### Requirement 8: Security and Rate Limiting

**User Story:** As a system administrator, I want to prevent abuse of the download tracking system, so that metrics remain trustworthy and costs stay controlled.

#### Acceptance Criteria

1. THE Track_Download_API SHALL require valid authentication tokens for all requests
2. THE Track_Download_API SHALL validate that the authenticated user is requesting download tracking (not spoofing other users)
3. THE API_Gateway SHALL apply rate limiting of 100 requests per minute per IP address
4. THE Track_Download_API SHALL reject requests with invalid or malformed parameters
5. THE Track_Download_API SHALL sanitize all input parameters to prevent injection attacks
