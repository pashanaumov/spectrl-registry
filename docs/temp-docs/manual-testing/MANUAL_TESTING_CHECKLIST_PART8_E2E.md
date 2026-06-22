# Part 8: End-to-End User Journeys

## 18. COMPLETE AUTHOR JOURNEY

### 18.1 New Author - First Spec

**Goal:** Complete first-time author experience

- [ ] Install CLI: `npm install -g @spectrl/cli`
- [ ] Verify installation: `spectrl --version`
- [ ] Login: `spectrl login`
- [ ] Complete GitHub OAuth flow
- [ ] Verify: `spectrl whoami` shows username
- [ ] Create new spec: `spectrl new my-first-spec`
- [ ] Add content: create README.md, docs/
- [ ] Edit spectrl.json: add files, description, tags
- [ ] Publish locally: `spectrl publish`
- [ ] Verify in local registry
- [ ] Publish to public: configure for public registry
- [ ] Publish: `spectrl publish`
- [ ] Visit web: find spec at /specs/username/my-first-spec
- [ ] Verify all content visible
- [ ] Verify install command works
- [ ] Share link with colleague

**Expected:** Smooth onboarding, clear at each step, successful publish

### 18.2 Author - Update Existing Spec

**Goal:** Publish new version of existing spec

- [ ] Clone existing spec directory
- [ ] Make changes to content
- [ ] Update version in spectrl.json
- [ ] Update description/tags
- [ ] Publish: `spectrl publish`
- [ ] Visit web, verify new version appears
- [ ] Switch between versions on web
- [ ] Verify old version still accessible
- [ ] Verify install command includes new version

**Expected:** Easy to update, versions managed correctly

### 18.3 Author - Unpublish Spec

**Goal:** Remove spec from public registry

- [ ] Identify spec to unpublish
- [ ] Run: `spectrl unpublish username/spec@1.0.0`
- [ ] Confirm action
- [ ] Verify success message
- [ ] Visit web, verify version removed
- [ ] Verify other versions still available
- [ ] Try to install unpublished version (should fail)

**Expected:** Clear confirmation, clean removal

## 19. COMPLETE CONSUMER JOURNEY

### 19.1 New Consumer - Discover & Install

**Goal:** First-time user finds and installs spec

- [ ] Visit https://spectrl.pro
- [ ] Read homepage, understand value
- [ ] Click "Browse Specs"
- [ ] Browse available specs
- [ ] Use search to find relevant spec
- [ ] Click on interesting spec
- [ ] Read spec details, files, README
- [ ] Decide to install
- [ ] Copy install command
- [ ] Open terminal
- [ ] Install CLI if needed: `npm install -g @spectrl/cli`
- [ ] Create new project directory
- [ ] Run: `spectrl init`
- [ ] Paste install command: `spectrl install username/spec`
- [ ] Verify spec installed
- [ ] Explore installed files
- [ ] Use spec content in project
- [ ] Success!

**Expected:** Intuitive discovery, easy installation, clear value

### 19.2 Consumer - Install with Dependencies

**Goal:** Install spec that has dependencies

- [ ] Find spec with dependencies on web
- [ ] Note dependencies listed
- [ ] Copy install command
- [ ] Run install command
- [ ] Verify main spec installed
- [ ] Verify dependencies auto-installed
- [ ] Run: `spectrl list` to see all
- [ ] Verify lock file created
- [ ] Commit lock file to git
- [ ] Colleague clones repo
- [ ] Colleague runs: `spectrl install`
- [ ] Verify exact same versions installed

**Expected:** Dependencies transparent, reproducible

### 19.3 Consumer - Update Installed Specs

**Goal:** Keep specs up to date

- [ ] Install spec: `username/spec@1.0.0`
- [ ] Use spec for a while
- [ ] Author publishes 1.1.0
- [ ] Run: `spectrl update username/spec`
- [ ] Verify update detected
- [ ] Verify new version installed
- [ ] Verify changes reflected
- [ ] Run: `spectrl update --all`
- [ ] Verify all specs checked
- [ ] Verify all updates applied

**Expected:** Easy updates, clear what changed

## 20. COLLABORATION WORKFLOWS

### 20.1 Team - Shared Spec Library

**Goal:** Team uses shared internal specs

- [ ] Team member A creates spec
- [ ] Publishes to public registry
- [ ] Team member B searches and finds
- [ ] Installs in their project
- [ ] Uses spec content
- [ ] Suggests improvement
- [ ] Team member A updates spec
- [ ] Publishes new version
- [ ] Team member B runs update
- [ ] Gets latest changes
- [ ] Team synchronized

**Expected:** Smooth collaboration, easy sharing

### 20.2 Open Source - Community Spec

**Goal:** Community contributes to spec

- [ ] Author publishes spec
- [ ] Community discovers on web
- [ ] Multiple users install
- [ ] Users provide feedback
- [ ] Author iterates based on feedback
- [ ] Publishes improved versions
- [ ] Community updates
- [ ] Spec improves over time

**Expected:** Enables community collaboration

## 21. COMPLEX DEPENDENCY SCENARIOS

### 21.1 Diamond Dependency

**Goal:** Handle diamond dependency correctly

- [ ] Create spec A (no deps)
- [ ] Create spec B (depends on A@1.0.0)
- [ ] Create spec C (depends on A@1.0.0)
- [ ] Create spec D (depends on B and C)
- [ ] Publish all
- [ ] Install D
- [ ] Verify A installed only once
- [ ] Verify correct version of A
- [ ] Verify all specs work together

**Expected:** Resolves correctly, no duplicates

### 21.2 Version Range Resolution

**Goal:** Handle version ranges (if supported)

- [ ] Create spec with dependency range
- [ ] Install spec
- [ ] Verify correct version selected
- [ ] Publish new version of dependency
- [ ] Update
- [ ] Verify stays within range
- [ ] Publish version outside range
- [ ] Verify doesn't auto-update

**Expected:** Respects version constraints

### 21.3 Conflicting Dependencies

**Goal:** Detect and report conflicts

- [ ] Spec A depends on C@1.0.0
- [ ] Spec B depends on C@2.0.0
- [ ] Try install both A and B
- [ ] Verify conflict detected
- [ ] Verify clear error message
- [ ] Verify suggests resolution
- [ ] Manually resolve (choose version)
- [ ] Verify resolution works

**Expected:** Clear conflict detection and resolution
