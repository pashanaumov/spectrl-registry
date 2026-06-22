# Requirements Document

## Introduction

Migrate the Spectrl product website from the current production Next.js app (`apps/spectrl-web/`) to a new implementation based on a v0.dev design prototype (`spectrl-website-design-v0/`). The migration preserves all existing production functionality (Zod-validated API client, cursor-based pagination, spec detail with version selector and MDX rendering, search) while adopting the v0 design's visual identity (landing page, layout, component styling). The docs system is replaced: Nextra is removed in favor of `.mdx` files on disk compiled with `next-mdx-remote` and a custom sidebar generated from frontmatter metadata.

## Glossary

- **Website**: The Next.js App Router application serving the Spectrl product site at `apps/spectrl-web/`
- **V0_Shell**: The v0.dev design prototype at `spectrl-website-design-v0/`, containing visual components with mock data
- **API_Client**: The server-side module (`lib/api-client.ts`) that fetches data from the Spectrl backend API with Zod validation
- **Schemas_Module**: The Zod schema definitions (`lib/schemas.ts`) used to validate all external API responses
- **Env_Module**: The environment configuration module (`lib/env.ts`) using `@t3-oss/env-nextjs` for validated env vars
- **Search_Page**: The `/specs` route that lists and searches published specs with server-side data fetching
- **Spec_Detail_Page**: The `/specs/[username]/[spec]` route that displays a single spec's metadata, files, and MDX content
- **Docs_System**: The documentation pages served under `/docs/[slug]`, compiled from `.mdx` files on disk using `next-mdx-remote`
- **Landing_Page**: The root `/` route with hero, CLI demo, features, how-it-works, and install CTA sections
- **Sidebar**: The docs navigation component generated from frontmatter metadata in `.mdx` files
- **SearchForm**: The client-side search input component with debounced URL synchronization
- **PaginationControls**: The client-side cursor-based pagination component with history management
- **VersionSelector**: The combobox component for selecting spec versions on the detail page
- **FileNav**: The tab navigation component for switching between files within a spec version
- **SpecContent**: The component that fetches and renders spec file content as MDX
- **CopyButton**: The clipboard copy component used for install commands
- **MDX_Compiler**: The `next-mdx-remote` library used to compile markdown/MDX content into React components

## Requirements

### Requirement 1: Project Foundation and Monorepo Integration

**User Story:** As a developer, I want the v0 design prototype moved into the monorepo as the new `apps/spectrl-web/` package, so that the website builds and runs within the existing pnpm workspace.

#### Acceptance Criteria

1. WHEN the Website is built, THE Website SHALL compile without errors as a pnpm workspace member at `apps/spectrl-web/`
2. WHEN the Website is initialized, THE Env_Module SHALL validate environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CDN_URL`) using `@t3-oss/env-nextjs` with Zod schemas
3. THE Website SHALL include all production dependencies from both the V0_Shell (Radix, shadcn/ui, lucide-react, next-themes, tailwind-merge, class-variance-authority) and the existing app (zod, `@t3-oss/env-nextjs`, `next-mdx-remote`, cmdk)
4. THE Website SHALL include all dev dependencies required for testing (vitest, msw, fast-check, happy-dom, `@testing-library/react`)
5. THE Website SHALL remove unused V0_Shell dependencies (recharts, embla-carousel-react, react-day-picker, react-resizable-panels, `@vercel/analytics`, react-hook-form, `@hookform/resolvers`, input-otp, vaul, sonner, date-fns)
6. THE Website SHALL use Tailwind CSS v4 with the `@tailwindcss/postcss` plugin
7. THE Website SHALL configure Vitest with happy-dom environment, path aliases, and a setup file that sets mock environment variables

### Requirement 2: Data Layer and API Integration

**User Story:** As a developer, I want the Zod-validated API client ported into the new website shell, so that all external data is validated before use.

#### Acceptance Criteria

1. THE API_Client SHALL provide a `searchSpecs` function that fetches search results from the backend API and validates the response with the `SearchResponseSchema`
2. THE API_Client SHALL provide a `getSpec` function that fetches spec metadata from the backend API and validates the response with the `GetSpecResponseSchema`
3. THE API_Client SHALL provide a `getSpecFile` function that fetches individual file content from the CDN
4. WHEN the API returns a response that does not match the expected Zod schema, THE API_Client SHALL throw an `ApiError` with a descriptive validation error message
5. WHEN a network request fails, THE API_Client SHALL throw a `NetworkError` with the underlying cause
6. THE Schemas_Module SHALL define Zod schemas for `SearchResponse`, `GetSpecResponse`, `SpecVersion`, `SearchResult`, and `ApiErrorResponse`
7. IF the API returns an HTTP error status, THEN THE API_Client SHALL attempt to parse the error body with `ApiErrorResponseSchema` and include the error message

### Requirement 3: Specs Browse Page with Server-Side Search

**User Story:** As a user, I want to search and browse published specs with real data from the registry API, so that I can discover specs to install.

#### Acceptance Criteria

1. WHEN a user visits the Search_Page, THE Search_Page SHALL fetch specs from the backend API using `searchSpecs` and display the results
2. WHEN a user types in the SearchForm and submits, THE SearchForm SHALL update the URL query parameter `q` and trigger a server-side search
3. WHEN the URL contains a `q` parameter, THE Search_Page SHALL pass the query to `searchSpecs` and display filtered results
4. WHEN the API returns results with `hasMore` or a `nextToken`, THE PaginationControls SHALL display Next and Previous buttons for cursor-based navigation
5. WHEN a user clicks the Next button, THE PaginationControls SHALL navigate to the next page by setting the `next` URL parameter to the response's `nextToken`
6. WHEN a user clicks the Previous button, THE PaginationControls SHALL navigate to the previous page using the cursor history stored in session storage
7. WHEN the API returns zero results, THE Search_Page SHALL display an empty state with a message and a link to clear the search
8. IF the API request fails, THEN THE Search_Page SHALL display an error state with a retry link
9. WHILE results are loading, THE Search_Page SHALL display skeleton loading placeholders

### Requirement 4: Spec Detail Page with Version Selection and File Rendering

**User Story:** As a user, I want to view a spec's details including its description, metadata, files, and install command, so that I can evaluate and install the spec.

#### Acceptance Criteria

1. WHEN a user visits the Spec_Detail_Page, THE Spec_Detail_Page SHALL fetch spec metadata using `getSpec` and display the spec name, description, tags, author, publish date, and download count
2. WHEN the Spec_Detail_Page loads, THE Spec_Detail_Page SHALL fetch the first file's content using `getSpecFile` and render it as MDX using the MDX_Compiler
3. WHEN a user selects a different version using the VersionSelector, THE Spec_Detail_Page SHALL navigate to the same page with the `v` query parameter set to the selected version
4. WHEN the Spec_Detail_Page displays multiple files, THE FileNav SHALL render tab buttons for each file and allow switching between files
5. WHEN a user selects a different file in the FileNav, THE SpecContent SHALL fetch the file content from the CDN and render it as MDX
6. THE Spec_Detail_Page SHALL display an install command in a code block with a CopyButton that copies the command to the clipboard
7. IF the spec is not found (API returns 404), THEN THE Spec_Detail_Page SHALL trigger the Next.js `notFound()` handler
8. IF a file fails to load, THEN THE SpecContent SHALL display an error message within the content area

### Requirement 5: Documentation System with MDX Files on Disk

**User Story:** As a user, I want to read product documentation rendered from `.mdx` files, so that I can learn how to use Spectrl.

#### Acceptance Criteria

1. THE Docs_System SHALL read `.mdx` files from a `content/docs/` directory on disk
2. WHEN a user visits `/docs/[slug]`, THE Docs_System SHALL locate the corresponding `.mdx` file by slug, compile it with the MDX_Compiler, and render the content
3. THE Docs_System SHALL generate the Sidebar navigation from frontmatter metadata (title, order) in each `.mdx` file
4. THE Docs_System SHALL include documentation pages for: Introduction, Getting Started, Installation, and CLI Reference
5. WHEN a user visits `/docs`, THE Docs_System SHALL redirect to or display the Introduction page
6. IF a requested doc slug does not match any `.mdx` file, THEN THE Docs_System SHALL trigger the Next.js `notFound()` handler
7. THE Docs_System SHALL render a mobile-friendly navigation component for doc pages on small screens
8. THE Website SHALL remove all Nextra dependencies (`nextra`, `nextra-theme-docs`) and related configuration

### Requirement 6: Landing Page

**User Story:** As a visitor, I want to see an informative landing page that explains what Spectrl is and how to get started, so that I can understand the product.

#### Acceptance Criteria

1. WHEN a user visits the Landing_Page, THE Landing_Page SHALL display the hero section, CLI demo, features section, how-it-works section, and install CTA section from the V0_Shell design
2. WHEN a user submits a search query from the Landing_Page hero section, THE Landing_Page SHALL navigate to `/specs?q={query}` to perform a real search
3. THE Landing_Page SHALL use the V0_Shell's visual design components (SiteHeader, SiteFooter, Hero, CliDemo, Features, HowItWorks, InstallCta)

### Requirement 7: Shared Components and Theming

**User Story:** As a user, I want consistent theming, navigation, and interactive components across all pages, so that the website feels cohesive.

#### Acceptance Criteria

1. THE Website SHALL support dark and light themes using `next-themes` with a theme toggle component
2. THE Website SHALL use the V0_Shell's SiteHeader component with navigation links to Home, Specs, and Docs
3. THE Website SHALL use the V0_Shell's SiteFooter component on all pages
4. THE CopyButton SHALL copy the provided text to the clipboard and display visual feedback (icon change) on success
5. THE Website SHALL use the V0_Shell's SpectrlLogo component for consistent branding
6. THE Website SHALL remove unused shadcn/ui components from the V0_Shell that are not referenced by any page or component

### Requirement 8: Testing Infrastructure and Test Porting

**User Story:** As a developer, I want all existing automated tests ported and passing in the new website, so that regressions are caught during development.

#### Acceptance Criteria

1. THE Website SHALL configure Vitest with happy-dom environment, path aliases (`@` → `src/`), and a test setup file that sets `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_CDN_URL` mock environment variables
2. THE Website SHALL port the API client test suite (`api-client.test.ts`) that uses MSW to mock HTTP responses and verifies: successful search with pagination, query parameter passing, rejection of invalid API responses, handling of API error status codes, and handling of responses without pagination fields
3. THE Website SHALL port the `useCursorHistory` hook test suite (`useCursorHistory.test.ts`) that verifies: empty initialization, push/pop operations, duplicate prevention, session storage persistence, loading from session storage on mount, separate storage keys per query, graceful handling of corrupted storage data, and storage cleanup on clear
4. THE Website SHALL port the PaginationControls test suite (`PaginationControls.test.tsx`) that verifies: result count display (singular and plural), Previous/Next button rendering and disabled states, ARIA labels for accessibility, cursor push on mount, navigation URL construction for both Next and Previous actions
5. WHEN running `pnpm test` from the Website package, THE test runner SHALL execute all test suites and report results
6. THE Website SHALL include `fast-check` as a dev dependency for property-based testing of data validation logic
7. THE Website SHALL include `msw`, `@testing-library/react`, `@testing-library/user-event`, and `happy-dom` as dev dependencies for test infrastructure
