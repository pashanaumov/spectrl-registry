# Missing Features from Launch Epics

This document tracks features from `docs/public-registry/launch-epics.md` that are not yet implemented.

## ✅ Fully Implemented Epics

- **Epic 1: Infrastructure Foundation** - Complete
- **Epic 2: Authentication System** - Complete (GitHub Device Flow)
- **Epic 3: Publishing System** - Complete
- **Epic 5: CLI - Token Management** - Complete
- **Epic 6: CLI - Authentication Commands** - Complete (login, logout, whoami)
- **Epic 7: CLI - Public Registry Publishing** - Complete
- **Epic 8: CLI - Installing from Public Registry** - Complete
- **Epic 9: CLI - Discovery Commands** - Complete (search, info, list, update, unpublish)

## ⚠️ Partially Implemented Epics

### Epic 4: Discovery & Retrieval System

**Status:** 4/5 stories complete

**Missing:**

- ❌ **Download tracking** (Story 5)
  - Lambda@Edge or CloudFront function to track downloads
  - Update DynamoDB on spec fetch
  - Increment download counter
  - **Impact:** Downloads counter always shows 0

**Implemented:**

- ✅ search-specs Lambda
- ✅ get-spec Lambda
- ✅ unpublish-spec Lambda
- ✅ API Gateway routes with CORS

---

### Epic 10: Website - Landing Page

**Status:** Core complete, missing featured specs

**Missing:**

- ❌ **Featured specs section** (Story 3)
  - Fetch featured specs from API
  - Display in grid layout
  - Spec cards with install command
  - Copy-to-clipboard button

**Implemented:**

- ✅ Next.js project setup
- ✅ Hero section
- ✅ CLI demo section
- ✅ Features section
- ✅ How It Works section
- ✅ Install CTA
- ✅ Footer

---

### Epic 11: Website - Public Index & Browse

**Status:** Basic browse implemented, missing advanced features

**Missing:**

- ❌ **Search & filter** (Story 2)
  - Search input (client-side filtering)
  - Category dropdown filter
  - Sort options (newest, popular, alphabetical)
- ❌ **User profile page** (Story 4)
  - List all specs by user
  - Total download count
  - Link to GitHub profile
- ⚠️ **Performance optimization** (Story 5)
  - Pagination/infinite scroll (basic pagination exists)
  - Cache API responses
  - Optimize images

**Implemented:**

- ✅ Specs index page (`/specs`)
- ✅ Spec detail page (`/specs/[username]/[spec]`)
- ✅ Version selector
- ✅ README rendering
- ✅ Install command with copy button
- ✅ Basic loading states

---

## ❌ Not Started Epics

### Epic 12: Website - Documentation Site

**Status:** Not started

**Missing all stories:**

1. Set up Nextra
2. Write Getting Started docs
3. Write Core Concepts docs
4. Write CLI Reference docs
5. Write Spec Format docs
6. Write Examples docs
7. Add troubleshooting & FAQ

**Current state:** `/docs` route exists but appears to be placeholder

---

### Epic 13-17: Content Creation

**Status:** Not started

**Missing:**

- Epic 13: 10 scaffolding specs (Next.js, React, FastAPI, etc.)
- Epic 14: 8 architecture pattern specs
- Epic 15: 11 testing & AI specs
- Epic 16: 16 book & best practice specs
- Epic 17: 5 process template specs

**Total:** 50 high-quality specs to create

---

### Epic 18: Testing & Quality Assurance

**Status:** Partial (unit tests exist, missing comprehensive QA)

**Missing:**

1. End-to-end infrastructure testing
2. CLI cross-platform testing (macOS, Linux, Windows/WSL)
3. Website testing (browser compatibility, mobile, performance, accessibility)
4. Integration testing (full workflow: login → publish → install)
5. Security review

**Current state:** Unit tests exist for most modules, but no formal QA process

---

### Epic 19: Beta Testing Program

**Status:** Not started

**Missing all stories:**

1. Recruit beta users
2. Create beta testing guide
3. Onboard beta users
4. Collect and prioritize feedback
5. Fix critical issues

---

### Epic 20: Launch Preparation

**Status:** Not started

**Missing all stories:**

1. ❌ Create demo video (2 min)
2. ❌ Set up monitoring & analytics
   - Plausible Analytics on website
   - UptimeRobot for API
   - Sentry for error tracking
   - CloudWatch alarms for Lambda
3. ❌ Write launch posts
   - Product Hunt submission
   - Show HN post
   - Twitter thread
   - LinkedIn post
4. ❌ Create launch assets
   - Screenshots
   - GIFs of key workflows
   - Social media graphics
5. ❌ Polish website & docs
6. ❌ Prepare support infrastructure
   - Support email
   - FAQ
   - Discord/Slack community

---

### Epic 21: Launch Execution

**Status:** Not started (depends on Epic 20)

---

## Priority Recommendations

### P0 (Critical for Launch)

1. **Prompt injection scanning on publish**
   - Pattern-based heuristic scan runs as a validation step during `spectrl publish` (public registry)
   - Regex/keyword detection for common injection phrases (~30-50 patterns)
   - Invisible/suspicious character detection (zero-width chars, homoglyphs, hidden HTML)
   - Soft gate: warn and ask to confirm, not hard block (avoids false positive friction)
   - ~100-200 lines of scanner logic in `packages/core`, wired into publish flow in `packages/cli`

2. **Download tracking** (Epic 4, Story 5)
   - Users expect to see download counts
   - Relatively simple to implement

3. **Documentation site** (Epic 12)
   - Users need docs to understand the product
   - Critical for adoption

4. **Demo video** (Epic 20, Story 1)
   - Key for Product Hunt/HN launch
   - Helps users understand value quickly

5. **Monitoring & analytics** (Epic 20, Story 2)
   - Need visibility into production issues
   - Essential for launch day

### P1 (Important for Launch)

5. **Featured specs section** (Epic 10, Story 3)
   - Makes landing page more compelling
   - Shows real-world value

6. **Search & filter on browse page** (Epic 11, Story 2)
   - Improves discoverability
   - Better UX

7. **Launch materials** (Epic 20, Stories 3-6)
   - Product Hunt post
   - Show HN post
   - Screenshots/GIFs
   - Social posts

### P2 (Nice to Have)

8. **User profile pages** (Epic 11, Story 4)
   - Good for community building
   - Not critical for initial launch

9. **Content creation** (Epics 13-17)
   - 50 high-quality specs
   - Can be done post-launch incrementally

10. **Beta testing** (Epic 19)
    - Valuable but can be informal
    - Could do soft launch to friends instead

### P3 (Post-Launch)

11. **Comprehensive QA** (Epic 18)
    - Important but can be iterative
    - Focus on critical paths first

---

## Summary

**Completion Status:**

- ✅ Fully Complete: 9/21 epics (43%)
- ⚠️ Partially Complete: 4/21 epics (19%)
- ❌ Not Started: 8/21 epics (38%)

**Key Gaps:**

1. Download tracking (technical debt)
2. Documentation site (critical for users)
3. Launch preparation materials (needed for launch)
4. Content creation (50 specs to create)
5. Formal testing & QA process

**Estimated Work Remaining:**

- P0 items: ~5-7 days
- P1 items: ~5-7 days
- P2 items: ~10-15 days
- P3 items: ~5-10 days
- Content creation: ~10-20 days (can be ongoing)

**Total: ~35-60 days of work remaining for full launch readiness**
