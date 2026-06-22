# Implementation Plan: Website Migration

## Overview

Migrate the Spectrl website by starting from the v0 design shell, copying the existing data layer and tests directly, wiring real API calls into the v0 components, replacing Nextra with a custom MDX docs system, and cleaning up unused dependencies. Each task builds incrementally — no orphaned code.

## Tasks

- [x] 1. Project foundation — scaffold the new app from v0 shell
  - [x] 1.1 Back up the current `apps/spectrl-web/` directory (rename to `apps/spectrl-web-old/`), then copy `spectrl-website-design-v0/` into `apps/spectrl-web/`
    - Restructure to use `src/` directory: move `app/`, `components/`, `hooks/`, `lib/`, `styles/` under `src/`
    - Update `tsconfig.json` paths alias to `@` → `./src`
    - Rename `package.json` name field to `spectrl-web`
    - _Requirements: 1.1_

  - [x] 1.2 Clean up `package.json` dependencies
    - Remove unused v0 deps: `recharts`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`, `@vercel/analytics`, `react-hook-form`, `@hookform/resolvers`, `input-otp`, `vaul`, `sonner`, `date-fns`, `autoprefixer`
    - Add production deps from existing app: `@t3-oss/env-nextjs`, `next-mdx-remote`
    - Add dev deps: `vitest`, `msw`, `fast-check`, `happy-dom`, `@testing-library/react`, `@testing-library/user-event`
    - Ensure `zod` and `cmdk` are present
    - Replace `tailwindcss-animate` with `tw-animate-css` if needed
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 1.3 Set up build and test configuration
    - Create `vitest.config.ts` with happy-dom environment, `@` path alias, and setup file reference
    - Create `.env.development` and `.env.production` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_CDN_URL`
    - Verify `postcss.config.mjs` uses `@tailwindcss/postcss`
    - Update `next.config.mjs` if needed for the new structure
    - _Requirements: 1.6, 1.7_

- [x] 2. Copy data layer and tests from existing app
  - [x] 2.1 Copy `lib/` files from `apps/spectrl-web-old/src/lib/` into `apps/spectrl-web/src/lib/`
    - Copy: `api-client.ts`, `schemas.ts`, `env.ts`, `test-setup.ts`
    - Keep existing `utils.ts` from v0 shell (it has the same `cn()` function)
    - Adjust import paths if directory structure differs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.2 Copy `hooks/` from `apps/spectrl-web-old/src/hooks/` into `apps/spectrl-web/src/hooks/`
    - Copy: `useCursorHistory.ts`
    - Keep v0's `use-mobile.ts` and `use-toast.ts` if still referenced, otherwise remove
    - _Requirements: 3.4, 3.5, 3.6_

  - [x] 2.3 Copy test files from existing app
    - Copy: `api-client.test.ts` → `src/lib/api-client.test.ts`
    - Copy: `useCursorHistory.test.ts` → `src/hooks/useCursorHistory.test.ts`
    - Copy: `PaginationControls.test.tsx` → `src/components/PaginationControls.test.tsx`
    - Adjust import paths to match new directory structure
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 2.4 Write property tests for Zod schema validation
    - **Property 1: Schema validation accepts valid objects**
    - **Property 2: Schema validation rejects objects with missing required fields**
    - **Validates: Requirements 2.6**

  - [x] 2.5 Write property test for API client invalid response rejection
    - **Property 3: API client rejects invalid responses**
    - **Validates: Requirements 2.1, 2.2, 2.4**

- [x] 3. Checkpoint — verify data layer and tests
  - Ensure all tests pass (`pnpm test`), ask the user if questions arise.

- [x] 4. Wire specs browse page with real API data
  - [x] 4.1 Create `src/components/search-form.tsx` — search input component
    - Form-submit based (no debounce): on submit, navigate to `/specs?q={query}`
    - Read initial value from URL `?q` param via `useSearchParams`
    - Clear button to reset input
    - Support `autoFocus` prop
    - _Requirements: 3.2_

  - [x] 4.2 Create `src/components/pagination-controls.tsx` — cursor-based pagination
    - Copy pagination logic from existing `PaginationControls.tsx`
    - Adapt to v0 design styling (use v0's Button component)
    - Uses `useCursorHistory` hook for Previous/Next navigation
    - Shows result count, loading states via `useTransition`
    - _Requirements: 3.4, 3.5, 3.6_

  - [x] 4.3 Rewrite `src/app/specs/page.tsx` — browse page with real data
    - Server component that reads `searchParams` (`q`, `next`)
    - Calls `searchSpecs()` from API client
    - Renders search form, results list using v0's `SpecCard` component (adapted for `SearchResult` type), pagination controls
    - Empty state when no results, error state on API failure, skeleton loading via Suspense
    - _Requirements: 3.1, 3.3, 3.7, 3.8, 3.9_

  - [x] 4.4 Adapt `src/components/specs/spec-card.tsx` for real `SearchResult` data
    - Replace mock `Spec` type with `SearchResult` from schemas
    - Display: spec name (linked to detail page), version badge, author, description, tags, publish date, install command with CopyButton
    - _Requirements: 3.1_

- [x] 5. Wire spec detail page with real API data
  - [x] 5.1 Create `src/components/specs/version-selector.tsx` — version combobox
    - Copy logic from existing `VersionSelector.tsx`
    - Adapt to v0 design styling
    - Uses cmdk Command component for searchable version list
    - Navigates via `?v=` query parameter
    - _Requirements: 4.3_

  - [x] 5.2 Create `src/components/specs/file-nav.tsx` — file tab navigation
    - Copy logic from existing `FileNav.tsx`
    - Adapt to v0 design styling (border-bottom tabs like v0's spec-detail)
    - Hidden when only one file, deduplicates file list
    - _Requirements: 4.4_

  - [x] 5.3 Create `src/components/specs/spec-content.tsx` — MDX file renderer
    - Copy logic from existing `SpecContent.tsx`
    - Manages file selection state, fetches content via `getSpecFile()`
    - Compiles markdown with `next-mdx-remote` using styled component overrides
    - Shows loading spinner and error states
    - Integrates FileNav for file switching
    - _Requirements: 4.2, 4.5, 4.8_

  - [x] 5.4 Rewrite `src/app/specs/[username]/[spec]/page.tsx` — detail page with real data
    - Server component that calls `getSpec()` and `getSpecFile()`
    - Reads `?v` param for version selection, defaults to latest
    - Renders: spec name, description, tags, author, publish date, downloads, install command with CopyButton, VersionSelector, SpecContent
    - Handles 404 via `notFound()`, other errors via error boundary
    - Generates metadata for SEO
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7_

- [x] 6. Checkpoint — verify specs pages work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Build docs system with MDX files on disk
  - [x] 7.1 Create `src/content/docs/` directory with MDX files
    - Create 4 MDX files with frontmatter (title, order): `introduction.mdx` (order: 1), `getting-started.mdx` (order: 2), `installation.mdx` (order: 3), `cli-reference.mdx` (order: 4)
    - Port content from existing Nextra MDX files in `apps/spectrl-web-old/src/app/docs/`
    - _Requirements: 5.1, 5.4_

  - [x] 7.2 Create `src/lib/docs.ts` — docs utility functions
    - `getDocsList()`: reads all `.mdx` files from `content/docs/`, extracts frontmatter (title, order), returns sorted `DocMeta[]`
    - `getDocBySlug(slug)`: reads and compiles a single MDX file, returns `{ meta, content }` or `null`
    - Uses `next-mdx-remote` for compilation with styled component overrides
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.3 Write property test for docs sidebar ordering
    - **Property 4: Docs sidebar is sorted by order**
    - **Validates: Requirements 5.3**

  - [x] 7.4 Update `src/components/docs/docs-sidebar.tsx` — generate from frontmatter
    - Replace hardcoded `docsPages` import with call to `getDocsList()`
    - Render navigation links sorted by order
    - Highlight active page based on pathname
    - _Requirements: 5.3_

  - [x] 7.5 Update `src/components/docs/docs-mobile-nav.tsx` — generate from frontmatter
    - Same as sidebar but in mobile dropdown format
    - Replace hardcoded `docsPages` import
    - _Requirements: 5.7_

  - [x] 7.6 Rewrite `src/app/docs/[slug]/page.tsx` — render MDX from disk
    - Server component that calls `getDocBySlug(slug)`
    - Renders compiled MDX content with DocsMobileNav
    - Calls `notFound()` if slug doesn't match any file
    - Generates metadata from frontmatter title
    - _Requirements: 5.2, 5.6_

  - [x] 7.7 Update `src/app/docs/page.tsx` — docs index
    - Redirect to `/docs/introduction` or render introduction content directly
    - _Requirements: 5.5_

  - [x] 7.8 Update `src/app/docs/layout.tsx` — docs layout with sidebar
    - Keep v0 layout structure (SiteHeader, sidebar, main content, SiteFooter)
    - Pass docs list to sidebar component
    - _Requirements: 5.3_

- [x] 8. Shared components and cleanup
  - [x] 8.1 Enhance `src/components/copy-button.tsx` with clipboard fallback
    - Add fallback for browsers without Clipboard API (textarea-based copy)
    - Ensure visual feedback (check icon) on success with 2s timeout
    - _Requirements: 7.4_

  - [x] 8.2 Remove unused shadcn/ui components and v0 mock data
    - Delete `src/lib/mock-data.ts` and `src/lib/docs-content.ts`
    - Audit `src/components/ui/` — remove components not imported by any page or component
    - Remove unused v0 hooks if not referenced
    - _Requirements: 7.6_

  - [x] 8.3 Remove Nextra dependencies and configuration
    - Ensure `nextra` and `nextra-theme-docs` are not in `package.json`
    - Remove any Nextra-related config from `next.config.mjs`
    - _Requirements: 5.8_

  - [x] 8.4 Verify theming and shared layout
    - Ensure ThemeProvider wraps the app in root layout
    - Verify theme toggle works (dark/light)
    - Verify SiteHeader has nav links to Home, Specs, Docs
    - Verify SiteFooter is on all pages
    - Verify SpectrlLogo is used
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [ ] 9. Final checkpoint — all tests pass, app builds
  - Run `pnpm test` — all test suites pass
  - Run `pnpm build` — app compiles without errors
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.1, 8.1, 8.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The data layer (`lib/` files) and existing tests are copied directly from the old app — no rewriting
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
