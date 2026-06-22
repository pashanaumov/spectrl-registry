# Phase 4: Website - Implementation Tasks

- [x] 1. Astro Project Setup with shadcn/ui

- [x] 1.1 Create Astro project in `apps/web/`
  - Run `pnpm create astro@latest apps/web -- --template minimal --typescript`
  - Navigate to `apps/web` directory
  - _Requirements: NFR-4_

- [x] 1.2 Install and configure React integration + Vercel adapter
  - Install React integration: `pnpm astro add react`
  - Install Tailwind CSS: `pnpm astro add tailwind`
  - Install Vercel adapter: `pnpm astro add vercel`
  - Configure hybrid rendering in `astro.config.mjs`
  - Test React component renders
  - _Requirements: NFR-4_

- [x] 1.3 Install and configure Starlight for documentation
  - Use Context7 MCP server to get Astro Starlight documentation
  - Install Starlight: `pnpm install @astrojs/starlight`
  - Configure in `astro.config.mjs` following Starlight docs
  - Create basic docs structure
  - _Requirements: FR-4_

- [x] 1.4 Initialize shadcn/ui
  - Use Context7 MCP server to get shadcn/ui documentation for setup
  - Run `npx shadcn-ui@latest init`
  - Configure `components.json` for Astro (follow shadcn docs)
  - Install core components: `pnpm dlx shadcn-ui@latest add button card input select badge`
  - _Requirements: NFR-3_

- [x] 1.5 Configure environment files
  - Create `.env.development` with LocalStack URLs
  - Create `.env.production` with production API URLs
  - Add environment variables to `.env.example`
  - _Requirements: NFR-4_

- [x] 1.6 Test development setup
  - Run `pnpm dev` and verify server starts
  - Test React component hydration
  - Test Tailwind styles
  - Test shadcn component imports

---

- [x] 2. API Client and Schemas

- [x] 2.1 Test API endpoints and create Zod schemas
  - First, test the actual API endpoints to understand response shape:
    - Call `GET /specs/search` (with and without query)
    - Call `GET /specs/{username}/{specName}` with real data
    - Call CloudFront URL for README.md
  - Create `src/lib/schemas.ts` based on actual API responses
  - Define schemas: `SearchResponseSchema`, `GetSpecResponseSchema`, `SpecVersionSchema`
  - Ensure schemas match exactly what the API returns
  - _Requirements: NFR-4, FR-2, FR-3_

- [x] 2.2 Create API client functions for server-side use
  - Create `src/lib/api-client.ts`
  - Implement `searchSpecs(query?: string)` function
  - Implement `getSpec(username: string, specName: string)` function
  - Implement `getReadme(s3Path: string)` function
  - Add proper error handling and Zod validation
  - Design for server-side usage (no browser APIs)
  - _Requirements: NFR-4_

- [x] 2.3 Remove client-side data fetching setup
  - No need for SWR or React Query (using SSR instead)
  - Focus on server-side API integration
  - Create utility functions for error handling
  - _Requirements: NFR-4_

- [x] 2.4 Test API integration
  - Test against LocalStack endpoints
  - Verify Zod validation works
  - Test error handling (404, network errors)
  - Test caching behavior

---

- [x] 3. Core shadcn Components

- [x] 3.1 Create SpecCard component
  - Use Context7 MCP server to get shadcn/ui Card and Button documentation
  - Create `src/components/SpecCard.tsx` as React component
  - Use shadcn Card, Button, Badge components following docs
  - Display spec name, description, version, tags
  - Add install command with copy button
  - Make responsive and accessible
  - _Requirements: FR-2, FR-3, NFR-3_

- [x] 3.2 Create SearchBar component
  - Use Context7 MCP server to get shadcn/ui Input documentation
  - Create `src/components/SearchBar.tsx` as React component
  - Use shadcn Input with search icon
  - Add debounced search (300ms delay)
  - Handle Enter key and search button
  - _Requirements: FR-1, FR-2_

- [x] 3.3 Create CodeBlock component
  - Use Context7 MCP server to get Astro Shiki documentation
  - Create `src/components/CodeBlock.astro`
  - Use Shiki for syntax highlighting following Astro docs
  - Support copy-to-clipboard functionality
  - Style with monochrome theme
  - _Requirements: FR-1_

- [x] 3.4 Test components
  - Test all components render correctly
  - Test responsive behavior on mobile
  - Test keyboard navigation
  - Test copy functionality

---

- [x] 4. Landing Page

- [x] 4.1 Create landing page structure
  - Create `src/pages/index.astro`
  - Add basic HTML structure and meta tags
  - Import and configure layout
  - _Requirements: FR-1_

- [x] 4.2 Build Hero section
  - Add headline: "Install production-ready specs in seconds"
  - Add subtitle explaining Spectrl value proposition
  - Add install command with syntax highlighting
  - Add CTAs using shadcn Button: "Get Started" and "Browse Specs"
  - _Requirements: FR-1_

- [x] 4.3 Add SearchBar to landing page
  - Integrate SearchBar component
  - Configure navigation to `/specs` with query parameter
  - Style for landing page context
  - _Requirements: FR-1_

- [x] 4.4 Create "How It Works" section
  - Add 3-step explanation of Spectrl workflow
  - Use clean, minimal design
  - Make responsive
  - _Requirements: FR-1_

- [x] 4.5 Create AI-Native callout section
  - Add section highlighting AI-native features
  - Use compelling copy and clean design
  - _Requirements: FR-1_

- [x] 4.6 Add footer
  - Add links to docs, GitHub, etc.
  - Keep minimal and clean
  - Make responsive

- [x] 4.7 Test and polish landing page
  - Test on mobile devices
  - Verify all links work
  - Test loading performance
  - _Requirements: NFR-1, NFR-3_

---

- [ ] 5. Spec Index Page

- [ ] 5.1 Create spec index page with SSR
  - Create `src/pages/specs/index.astro`
  - Add `export const prerender = false` for SSR
  - Fetch all specs server-side using `searchSpecs()`
  - Add proper meta tags with dynamic content
  - Handle API errors gracefully (show error page)
  - _Requirements: FR-2_

- [ ] 5.2 Implement search functionality
  - Add search form that submits to same page with query param
  - Handle search query from URL params server-side
  - Display search results using SpecCard components
  - Handle empty search results
  - _Requirements: FR-2_

- [ ] 5.3 Add client-side enhancements
  - Add sort dropdown using shadcn Select (client-side filtering)
  - Add tag filter (client-side filtering)
  - Use React islands for interactive elements only
  - Enhance with JavaScript, but ensure it works without
  - _Requirements: FR-2_

- [ ] 5.4 Test spec index page
  - Test with various search queries
  - Test sort and filter functionality
  - Test responsive behavior
  - Test SEO meta tags
  - Test server-side rendering (view source)
  - _Requirements: NFR-1, NFR-3_

---

- [ ] 6. Spec Detail Page

- [ ] 6.1 Create spec detail page with SSR
  - Create `src/pages/specs/[username]/[specName].astro`
  - Add `export const prerender = false` for SSR
  - Fetch spec metadata server-side using `getSpec()`
  - Add dynamic meta tags with real spec data
  - Handle 404 errors for non-existent specs
  - _Requirements: FR-3_

- [ ] 6.2 Implement server-side README rendering
  - Fetch README server-side using `getReadme()`
  - Render markdown on the server
  - Add proper styling for markdown content
  - Handle missing README gracefully
  - _Requirements: FR-3_

- [ ] 6.3 Add interactive elements as React islands
  - Version dropdown using shadcn Select (React island)
  - Install command copy button (React island)
  - Keep core content server-rendered for SEO
  - _Requirements: FR-3_

- [ ] 6.4 Test spec detail page
  - Test with various specs
  - Test version dropdown functionality
  - Test README rendering
  - Test error handling (404, API errors)
  - Test SEO meta tags (view source)
  - Test responsive behavior
  - _Requirements: NFR-1, NFR-3_

---

- [ ] 7. Basic Documentation Setup

- [ ] 7.1 Configure Starlight theme
  - Use Context7 MCP server to get Starlight theming documentation
  - Customize colors to match monochrome palette
  - Configure site title and navigation
  - Set up sidebar structure following Starlight docs
  - _Requirements: FR-4_

- [ ] 7.2 Create minimal documentation content
  - Create `src/content/docs/index.mdx` - Basic getting started
  - Create `src/content/docs/installation.mdx` - CLI installation
  - Create `src/content/docs/quick-start.mdx` - Quick start guide
  - Keep content minimal for MVP
  - _Requirements: FR-4_

- [ ] 7.3 Test documentation
  - Verify navigation works
  - Test search functionality
  - Test responsive behavior
  - Verify links work correctly
  - _Requirements: FR-4, NFR-3_

---

- [ ] 8. Infrastructure and Deployment Setup

- [ ] 8.0 Configure Terraform infrastructure for custom domains
  - Update Terraform configuration to support custom domain routing
  - Configure API Gateway custom domain for `api.spectrl.pro`
  - Configure CloudFront distribution custom domain for `cdn.spectrl.pro`
  - Set up Route53 DNS records for API and CDN subdomains
  - Update SSL certificates for custom domains
  - **Manual GoDaddy DNS Steps:**
    - Log into GoDaddy DNS management for spectrl.pro
    - Add CNAME record: `api.spectrl.pro` → `[API Gateway custom domain endpoint]`
    - Add CNAME record: `cdn.spectrl.pro` → `[CloudFront distribution domain]`
    - Verify DNS propagation (may take 24-48 hours)
    - Alternative: Update GoDaddy nameservers to point to Route53 (recommended)
  - Test API endpoints are accessible via custom domains
  - _Requirements: AC-5, NFR-4_

- [ ] 8.1 Configure Vercel deployment
  - Use Context7 MCP server to get Vercel + Astro deployment documentation
  - Create `vercel.json` configuration file
  - Set build command: `pnpm build` and output directory
  - Configure framework detection for Astro
  - _Requirements: AC-5_

- [ ] 8.2 Set up environment variables
  - Configure production environment variables in Vercel
  - Set `PUBLIC_API_URL=https://api.spectrl.pro`
  - Set `PUBLIC_CDN_URL` for CloudFront
  - _Requirements: AC-5_

- [ ] 8.3 Configure custom domain in Vercel
  - Add spectrl.pro domain in Vercel dashboard (Vercel manages main domain)
  - **Manual GoDaddy DNS Steps for Website:**
    - Log into GoDaddy DNS management for spectrl.pro
    - Add A record: `spectrl.pro` → `[Vercel IP addresses]` (get from Vercel dashboard)
    - Add CNAME record: `www.spectrl.pro` → `cname.vercel-dns.com`
    - **Note:** API and CDN subdomains are handled separately by AWS/Terraform in task 8.0
  - Verify SSL certificate provisioning in Vercel
  - Test website loads at spectrl.pro and www.spectrl.pro
  - _Requirements: AC-5_

- [ ] 8.4 Deploy and test
  - Deploy to preview environment first
  - Test all functionality in preview
  - Deploy to production
  - Verify all pages work with production API
  - _Requirements: AC-5_

---

- [ ] 9. Basic Testing and Polish

- [ ] 9.1 Smoke test all pages
  - Test landing page loads and functions
  - Test spec index page with search
  - Test spec detail page with various specs
  - Test documentation navigation
  - _Requirements: NFR-3_

- [ ] 9.2 Test on different devices
  - Test on mobile (iOS/Android)
  - Test on tablet
  - Test on desktop (different screen sizes)
  - Fix any responsive issues
  - _Requirements: NFR-3_

- [ ] 9.3 Test basic accessibility
  - Test keyboard navigation
  - Verify focus indicators work
  - Test with screen reader (basic check)
  - Fix any obvious accessibility issues
  - _Requirements: NFR-3_

- [ ] 9.4 Final polish
  - Fix any visual inconsistencies
  - Verify all links work
  - Test copy-to-clipboard functionality
  - Ensure loading states work properly
  - _Requirements: NFR-3_

---

## Summary

**Total Tasks:** 9 main sections (added infrastructure task 8.0 for custom domains)
**Estimated Time:** 6-8 days (includes infrastructure setup)
**Tech Stack:** Astro (hybrid rendering), React, shadcn/ui, Starlight, Tailwind CSS, Zod, Vercel Functions
**Domain:** spectrl.pro (main site via Vercel), api.spectrl.pro & cdn.spectrl.pro (via AWS/Terraform)

**Key Principles:**

- Hybrid rendering (SSG for static content, SSR for dynamic data)
- shadcn/ui for all interactive components
- Server-side data fetching for SEO and freshness
- React islands for interactivity only
- Monochrome aesthetic
- Type-safe API integration with Zod
- Accessibility first

**Key Changes to Hybrid SSR:**

- ✅ Using SSR for spec pages (better SEO, always fresh data)
- ✅ Server-side API calls (no loading states, proper meta tags)
- ✅ Removed SWR/React Query (not needed with SSR)
- ✅ Added Vercel adapter for Functions support
- ✅ Dynamic meta tags for social sharing

**Removed for MVP:**

- ❌ Advanced SEO optimization (meta tags, structured data)
- ❌ Performance optimization (Lighthouse tuning)
- ❌ Comprehensive documentation content
- ❌ Comprehensive testing suite

**Key API Endpoints Used:**

- `GET /specs/search?q={query}` - Returns `{results: SearchResult[], count: number}`
- `GET /specs/{username}/{specName}` - Returns `{specId, username, specName, versions: SpecVersion[]}`
- `GET /{s3Path}/README.md` - Returns raw markdown content

**Next Phase:** Content creation (separate spec) and advanced optimizations
