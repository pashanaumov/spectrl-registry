# Phase 4: Website (Next.js + Nextra) - Implementation Tasks

## Overview

Build a modern, performant website for Spectrl using Next.js App Router, server components, and Nextra documentation. This implementation reuses assets from the existing Astro app and deploys as a single Next.js application.

**Note:** This is a straightforward website implementation - do not create task log documents. The spec provides sufficient context and guidance.

## Tasks

- [x] 1. Next.js Project Setup and Asset Migration

- [x] 1.1 Create Next.js project in `apps/spectrl-web/`
  - Run `pnpm create next-app@latest apps/spectrl-web --typescript --tailwind --eslint --app --src-dir --import-alias="@/*"`
  - Navigate to `apps/spectrl-web` directory
  - Configure as part of existing monorepo workspace
  - _Requirements: 7.7_

- [x] 1.2 Install and configure core dependencies
  - Install Nextra: `pnpm add nextra nextra-theme-docs`
  - Install T3 Env: `pnpm add @t3-oss/env-nextjs`
  - Install Zod: `pnpm add zod`
  - Install fast-check for property testing: `pnpm add -D fast-check @types/node`
  - _Requirements: 7.4, 6.1_

- [x] 1.3 Copy and adapt assets from Astro app
  - Copy `.env.development` and `.env.production` files
  - Copy `tailwind.config.ts` and adapt for Next.js
  - Copy `components.json` for shadcn/ui configuration
  - Copy existing shadcn/ui components from `apps/web/src/components/ui/` to `src/components/ui/`
  - Copy and adapt Zod schemas from `apps/web/src/lib/schemas.ts` to `src/lib/schemas.ts`
  - _Requirements: 7.1, 7.3_

- [x] 1.4 Configure Next.js with Nextra and MDX support
  - Create `next.config.mjs` with Nextra integration
  - Configure MDX support (built into Nextra)
  - Create `theme.config.tsx` for Nextra docs theme
  - Configure monochrome color scheme and branding
  - Test development server starts correctly
  - Test MDX files render properly
  - _Requirements: 4.1_

- [x] 1.5 Set up T3 Env for environment validation
  - Create `src/lib/env.ts` with T3 Env configuration
  - Define client and server environment variable schemas
  - Update environment files to use `NEXT_PUBLIC_` prefixes
  - Test environment validation works in development
  - _Requirements: 7.4_

---

- [ ] 2. API Client and Type-Safe Integration

- [x] 2.1 Create server-side API client with Zod validation
  - Create `src/lib/api-client.ts` with T3 Env integration
  - Implement `searchSpecs()` function with SearchResultSchema validation
  - Implement `getSpec()` function with SpecMetadataSchema validation
  - Implement `getReadme()` function with proper error handling
  - Follow api-validation.md guidelines for all external data
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ]\* 2.2 Write property tests for API client functions
  - **Property 16: API response validation**
  - **Property 17: Error handling consistency**
  - **Property 18: README fetching reliability**
  - **Property 19: Invalid data handling**
  - Use MSW for HTTP mocking (never override global.fetch)
  - Test with minimum 100 iterations per property
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ] 2.3 Test API integration against LocalStack
  - Verify all API endpoints work with LocalStack
  - Test error scenarios (404, network failures, invalid data)
  - Validate Zod schema enforcement
  - Test environment variable validation
  - _Requirements: 7.2_

---

- [ ] 3. Core UI Components (TypeScript-First)

- [x] 3.1 Create SpecCard server component
  - Create `src/components/SpecCard.tsx` with proper TypeScript interfaces
  - Display spec metadata (name, description, version, tags)
  - Include install command with copy functionality
  - Use shadcn/ui Card, Button, Badge components
  - Make responsive and accessible
  - _Requirements: 2.1, 3.5_

- [x] 3.2 Create SearchForm client component
  - Create `src/components/SearchForm.tsx` with TypeScript interface
  - Use shadcn/ui Input component with search functionality
  - Handle form submission and URL parameter encoding
  - Add debounced search with proper TypeScript types
  - _Requirements: 1.4, 2.2_

- [x] 3.3 Create CopyButton client component
  - Create `src/components/CopyButton.tsx` with TypeScript interface
  - Implement clipboard API with error handling
  - Add visual feedback for successful copy
  - Ensure accessibility compliance
  - _Requirements: 3.4_

- [ ]\* 3.4 Write property tests for UI components
  - **Property 1: Search query parameter handling**
  - **Property 6: Spec card navigation**
  - **Property 10: Clipboard functionality**
  - Test component rendering with various props
  - Test user interactions and state changes
  - _Requirements: 1.4, 2.5, 3.4_

---

- [ ] 4. Landing Page Migration

- [x] 4.1 Create landing page structure
  - Create `src/app/page.tsx` as server component
  - Copy hero section content from Astro app
  - Copy "How It Works" section content
  - Copy AI-native callout content
  - Adapt styling to Next.js/Tailwind structure
  - _Requirements: 1.2, 1.3, 1.5, 1.6_

- [x] 4.2 Integrate interactive components
  - Add SearchForm component to landing page
  - Configure navigation to `/specs` with query parameters
  - Add CTA buttons linking to `/docs` and `/specs`
  - Ensure all links work correctly
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 4.3 Test and polish landing page
  - Test responsive behavior on mobile devices
  - Verify all navigation links work
  - Test search functionality
  - Ensure accessibility compliance
  - _Requirements: 5.4, 8.1, 8.2, 8.3, 8.4, 8.5_

---

- [ ] 5. Spec Index Page (Server Components)

- [x] 5.1 Create spec index page with server-side data fetching
  - Create `src/app/specs/page.tsx` as async server component
  - Fetch specs data server-side using `searchSpecs()`
  - Handle search query from URL parameters
  - Generate dynamic meta tags for SEO
  - Handle API errors gracefully with fallback UI
  - _Requirements: 2.1, 2.2, 5.2_

- [x] 5.2 Implement search and filtering functionality
  - Add SearchForm component for query input
  - Handle sort and filter parameters from URL
  - Display search results using SpecCard components
  - Show empty state when no results found
  - _Requirements: 2.2, 2.3, 2.4, 2.6_

- [ ]\* 5.3 Write property tests for spec index functionality
  - **Property 2: Spec data rendering consistency**
  - **Property 3: Search result filtering**
  - **Property 4: Category filtering accuracy**
  - **Property 5: Sort order consistency**
  - Test with various spec datasets and query combinations
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5.4 Test spec index page
  - Test server-side rendering (view page source)
  - Test search functionality with various queries
  - Test responsive behavior
  - Test SEO meta tags generation
  - _Requirements: 5.2, 5.3, 5.4_

---

- [] 6. Spec Detail Page (Server Components)

- [x] 6.1 Create spec detail page with dynamic routing
  - Create `src/app/specs/[username]/[name]/page.tsx` as async server component
  - Implement `generateMetadata()` for dynamic SEO tags
  - Fetch spec data and README content server-side
  - Handle 404 errors for non-existent specs
  - _Requirements: 3.1, 3.6, 5.2, 5.3_

- [x] 6.2 Implement version selection and README rendering
  - Display all available versions with metadata
  - Add version selector (client component)
  - Render README markdown with proper styling
  - Handle missing README files gracefully
  - _Requirements: 3.1, 3.2, 3.3, 3.7_

- [x] 6.3 Add interactive elements
  - Add CopyButton for install commands
  - Implement version switching functionality
  - Ensure all metadata is displayed correctly
  - _Requirements: 3.4, 3.5_

- [ ]\* 6.4 Write property tests for spec detail functionality
  - **Property 7: Version metadata display**
  - **Property 8: Version switching functionality**
  - **Property 9: Markdown rendering consistency**
  - **Property 11: Metadata completeness**
  - Test with various spec configurations and README content
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [ ] 6.5 Test spec detail page
  - Test with various specs and versions
  - Test README rendering with different markdown content
  - Test error handling (404, missing README)
  - Test SEO meta tags with real spec data
  - _Requirements: 3.6, 3.7, 5.2, 5.3_

---

- [ ] 7. Nextra Documentation Setup

- [x] 7.1 Configure Nextra documentation structure
  - [x] Create `src/app/docs/layout.tsx` with Nextra layout
  - [x] Set up documentation file structure in `src/app/docs/`
  - [x] Configure `_meta.ts` files for navigation
  - [x] Customize theme to match monochrome aesthetic
  - [x] Test MDX file rendering and navigation
  - _Requirements: 4.1_

- [x] 7.2 Create core documentation content
  - [x] Create `src/app/docs/page.mdx` - Documentation homepage
  - [x] Create `src/app/docs/getting-started.mdx` - Getting started guide
  - [x] Create `src/app/docs/cli-reference.mdx` - CLI command reference
  - [x] Create `src/app/docs/spec-format.mdx` - Spec format documentation
  - Keep content minimal for MVP
  - _Requirements: 4.4, 4.5, 4.6_

- [ ]\* 7.3 Write property tests for documentation functionality
  - **Property 12: Documentation search relevance**
  - **Property 13: Documentation navigation state**
  - Test search functionality and navigation
  - Test responsive behavior on mobile
  - _Requirements: 4.2, 4.3, 4.7_

- [x] 7.4 Test documentation site
  - [x] Test navigation and search functionality
  - [x] Test responsive behavior on mobile
  - [x] Verify all links work correctly
  - [x] Test accessibility compliance
  - _Requirements: 4.1, 4.2, 4.3, 4.7_

---

- [ ] 8. Responsive Design and Accessibility

- [x] 8.1 Implement responsive design system
  - Ensure all components work on mobile (< 768px)
  - Test touch targets meet 44px minimum
  - Verify text remains readable at all screen sizes
  - Test navigation on mobile devices
  - _Requirements: 5.4, 8.5_

- [x] 8.2 Implement accessibility features
  - Add proper ARIA labels and semantic HTML
  - Ensure keyboard navigation works throughout
  - Implement focus indicators for all interactive elements
  - Test with screen readers (basic validation)
  - _Requirements: 8.1, 8.2_

- [ ]\* 8.3 Write property tests for responsive and accessibility features
  - **Property 14: Responsive design consistency**
  - **Property 20: Keyboard navigation accessibility**
  - **Property 21: Screen reader compatibility**
  - **Property 22: Color contrast compliance**
  - **Property 23: Form validation clarity**
  - **Property 24: Touch target sizing**
  - Test across different screen sizes and interaction methods
  - _Requirements: 5.4, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8.4 Test accessibility compliance
  - Run automated accessibility tests with axe-core
  - Test keyboard navigation on all pages
  - Verify color contrast ratios meet WCAG AA
  - Test with screen reader software
  - _Requirements: 8.1, 8.2, 8.3_

---

- [ ] 9. SEO and Performance Optimization

- [ ] 9.1 Implement SEO optimization
  - Add proper meta tags to all pages
  - Implement Open Graph tags for social sharing
  - Generate sitemap.xml automatically
  - Add structured data (Schema.org) where appropriate
  - _Requirements: 5.2, 5.3_

- [ ]\* 9.2 Write property tests for SEO functionality
  - **Property 15: SEO metadata generation**
  - Test meta tag generation across different page types
  - Test Open Graph data for social sharing
  - _Requirements: 5.2, 5.3_

- [ ] 9.3 Performance optimization
  - Configure Next.js image optimization
  - Implement proper caching strategies
  - Optimize bundle size and loading performance
  - Test Core Web Vitals with Lighthouse
  - _Requirements: 5.1, 5.5_

---

- [ ] 10. Deployment and Infrastructure

- [ ] 10.1 Configure Vercel deployment
  - Create `vercel.json` configuration
  - Set up environment variables in Vercel dashboard
  - Configure custom domain (spectrl.pro)
  - Test deployment in preview environment
  - _Requirements: 7.5, 7.6_

- [ ] 10.2 Set up production environment
  - Configure production environment variables
  - Test API integration with production endpoints
  - Verify SSL certificate and domain configuration
  - Test all functionality in production
  - _Requirements: 7.5_

- [ ] 10.3 Final testing and launch
  - Run full test suite including property tests
  - Test all user flows end-to-end
  - Verify performance meets requirements (< 2s load time)
  - Monitor for any issues post-deployment
  - _Requirements: 5.1, 5.6_

---

## Summary

**Total Tasks:** 10 main sections with 31 implementation tasks
**Estimated Time:** 8-10 days
**Tech Stack:** Next.js 15 (App Router), Nextra, TypeScript, T3 Env, Zod, fast-check, shadcn/ui, Tailwind CSS
**Domain:** spectrl.pro (single Next.js deployment)

**Key Principles:**

- **TypeScript-first**: All code in TypeScript with proper interfaces
- **Server Components**: Zero client-side loading states, perfect SEO
- **Type-safe Environment**: T3 Env for validated environment variables
- **API Validation**: Zod schemas for all external data (following api-validation.md)
- **Property-based Testing**: 24 correctness properties with fast-check
- **Asset Reuse**: Copy and adapt from existing Astro app
- **Accessibility First**: WCAG AA compliance throughout

**Key Features:**

- ✅ Server-side data fetching with always-fresh data
- ✅ Type-safe API integration with comprehensive validation
- ✅ Superior documentation experience with Nextra
- ✅ Comprehensive property-based testing coverage
- ✅ Full accessibility and responsive design
- ✅ SEO optimization with dynamic meta tags

**Testing Strategy:**

- **Property Tests**: 24 properties covering all testable requirements
- **Unit Tests**: Component behavior and edge cases
- **Integration Tests**: API integration and component interactions
- **E2E Tests**: Complete user workflows
- **Accessibility Tests**: Automated testing with axe-core

**Optional Tasks (marked with \*):**

- Property-based tests are marked optional for faster MVP
- Can be enabled by removing "\*" marker if comprehensive testing desired
- Core implementation tasks are never optional

**Next Phase:** Execute tasks incrementally, starting with project setup and asset migration
