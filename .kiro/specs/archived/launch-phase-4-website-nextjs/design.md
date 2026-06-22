# Phase 4: Website (Next.js + Nextra) - Design Document

## Overview

A modern, performant website for Spectrl built with Next.js App Router and Nextra documentation framework. This design leverages server components for seamless AWS API integration, reuses the existing Astro landing page during transition, and provides a superior documentation experience through Nextra's mature ecosystem.

## Architecture

### Technology Stack

- **Framework**: Next.js 15.x with App Router
- **Server Components**: React Server Components for data fetching
- **Documentation**: Nextra 4.x (docs theme)
- **UI Components**: shadcn/ui (reused from existing Astro setup)
- **Styling**: Tailwind CSS with monochrome color palette
- **API Client**: Native fetch with Zod validation (server-side)
- **Environment Variables**: T3 Env for type-safe environment validation
- **Deployment**: Single Next.js app deployed to Vercel at spectrl.pro
- **Asset Reuse**: Copy landing page and components from existing Astro app

### Why Next.js + Nextra + Server Components?

- **Mature Ecosystem**: Rich tooling, extensive community, battle-tested patterns
- **Server Components**: Zero client-side loading states, perfect SEO, real-time data
- **Nextra Superiority**: Better search, theming, navigation than Starlight
- **Seamless API Integration**: Server components eliminate client-side complexity
- **Gradual Migration**: Run alongside Astro during transition
- **Performance**: Excellent Core Web Vitals with selective hydration

### Project Structure

```
apps/spectrl-web/                  # Next.js website application
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Landing page (copied from Astro)
│   │   ├── globals.css             # Tailwind + custom styles
│   │   ├── specs/
│   │   │   ├── page.tsx           # Spec index (Server Component)
│   │   │   └── [username]/
│   │   │       └── [name]/
│   │   │           └── page.tsx   # Spec detail (Server Component)
│   │   └── docs/                  # Nextra documentation
│   │       ├── layout.tsx         # Nextra docs layout
│   │       ├── page.mdx           # Docs homepage
│   │       ├── getting-started.mdx
│   │       ├── cli-reference.mdx
│   │       └── _meta.ts           # Nextra navigation config
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (copied from Astro)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── select.tsx
│   │   ├── SpecCard.tsx           # Server Component version
│   │   ├── SearchForm.tsx         # Client Component for search
│   │   └── CopyButton.tsx         # Client Component for clipboard
│   └── lib/
│       ├── api-client.ts          # Server-side API functions
│       ├── schemas.ts             # Zod schemas (copied from Astro)
│       ├── env.ts                 # T3 Env configuration
│       └── utils.ts               # Utility functions
├── next.config.mjs                # Next.js + Nextra configuration
├── theme.config.tsx               # Nextra theme configuration
├── tailwind.config.ts             # Tailwind config (copied from Astro)
├── components.json                # shadcn/ui config (copied from Astro)
├── .env.development               # Copied from Astro app
├── .env.production                # Copied from Astro app
└── package.json
```

## Components and Interfaces

### 1. Server Components (No Client-Side Loading)

#### Spec Index Page (`app/specs/page.tsx`)

```typescript
// Server Component - fetches data on server
interface SpecsPageProps {
  searchParams: {
    q?: string
    sort?: string
  }
}

export default async function SpecsPage({ searchParams }: SpecsPageProps) {
  // Server-side data fetching - no loading states needed
  const specs = await searchSpecs(searchParams.q, searchParams.sort)

  return (
    <div>
      <SearchForm defaultQuery={searchParams.q} />
      <div className="grid gap-4">
        {specs.map(spec => (
          <SpecCard key={spec.specId} spec={spec} />
        ))}
      </div>
    </div>
  )
}
```

#### Spec Detail Page (`app/specs/[username]/[name]/page.tsx`)

```typescript
import { Metadata } from 'next'

interface SpecDetailPageProps {
  params: {
    username: string
    name: string
  }
}

// Server Component with dynamic metadata
export async function generateMetadata({ params }: SpecDetailPageProps): Promise<Metadata> {
  const spec = await getSpec(params.username, params.name)

  return {
    title: `${spec.specName} by ${spec.username}`,
    description: spec.versions[0]?.description,
    openGraph: {
      title: `${spec.specName} by ${spec.username}`,
      description: spec.versions[0]?.description,
    },
  }
}

export default async function SpecDetailPage({ params }: SpecDetailPageProps) {
  // Parallel data fetching on server
  const [spec, readme] = await Promise.all([
    getSpec(params.username, params.name),
    getReadme(spec.versions[0].s3Path),
  ])

  return (
    <div>
      <SpecHeader spec={spec} />
      <VersionSelector versions={spec.versions} />
      <ReadmeContent content={readme} />
    </div>
  )
}
```

### 2. Client Components (Minimal TypeScript)

#### SearchForm Component

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'

interface SearchFormProps {
  defaultQuery?: string
}

export function SearchForm({ defaultQuery }: SearchFormProps) {
  const router = useRouter()

  const handleSearch = (query: string) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    router.push(`/specs?${params.toString()}`)
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      handleSearch(formData.get('q') as string)
    }}>
      <Input
        name="q"
        placeholder="Search specs..."
        defaultValue={defaultQuery}
      />
    </form>
  )
}
```

#### CopyButton Component

```typescript
'use client'

import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    // Add toast notification
  }

  return (
    <Button onClick={handleCopy} variant="outline" size="sm">
      Copy
    </Button>
  )
}
```

### 3. Nextra Documentation Setup

#### Root Layout (`app/docs/layout.tsx`)

```typescript
import { Layout, Navbar, Footer } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

interface DocsLayoutProps {
  children: React.ReactNode
}

const navbar = (
  <Navbar
    logo={<strong>Spectrl</strong>}
    projectLink="https://github.com/spectrl/spectrl"
  />
)

const footer = (
  <Footer>
    MIT {new Date().getFullYear()} © Spectrl
  </Footer>
)

export default async function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <Layout
      navbar={navbar}
      pageMap={await getPageMap()}
      docsRepositoryBase="https://github.com/spectrl/spectrl/tree/main/docs"
      footer={footer}
    >
      {children}
    </Layout>
  )
}
```

#### Nextra Theme Configuration (`theme.config.tsx`)

```typescript
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <strong>Spectrl</strong>,
  project: {
    link: 'https://github.com/spectrl/spectrl',
  },
  docsRepositoryBase: 'https://github.com/spectrl/spectrl/tree/main/docs',
  footer: {
    text: `MIT ${new Date().getFullYear()} © Spectrl`,
  },
  primaryHue: {
    dark: 0,    // Monochrome theme
    light: 0,
  },
  darkMode: true,
  search: {
    placeholder: 'Search documentation...',
  },
  editLink: {
    text: 'Edit this page on GitHub',
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback',
  },
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <span className="cursor-default">{title}</span>
      }
      return <>{title}</>
    },
    defaultMenuCollapseLevel: 1,
  },
  toc: {
    backToTop: true,
  },
}

export default config
```

## Data Models

### API Response Schemas (Reused from Astro)

```typescript
// lib/schemas.ts - Copy from existing Astro app
import { z } from 'zod';

export const SpecMetadataSchema = z.object({
  specId: z.string(),
  username: z.string(),
  specName: z.string(),
  versions: z.array(
    z.object({
      version: z.string(),
      s3Path: z.string(),
      hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      publishedAt: z.string(),
      description: z.string().optional(),
      agentTags: z.array(z.string()).optional(),
      downloads: z.number().optional(),
    }),
  ),
});

export const SearchResultSchema = z.object({
  specs: z.array(
    z.object({
      specId: z.string(),
      username: z.string(),
      specName: z.string(),
      latestVersion: z.string(),
      description: z.string().optional(),
      downloads: z.number().optional(),
      agentTags: z.array(z.string()).optional(),
      publishedAt: z.string(),
    }),
  ),
  total: z.number(),
});

export type SpecMetadata = z.infer<typeof SpecMetadataSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
```

## API Integration

### Server-Side API Client

```typescript
// lib/api-client.ts
import { SpecMetadataSchema, SearchResultSchema } from './schemas';
import { env } from './env';

const API_URL = env.NEXT_PUBLIC_API_URL;
const CDN_URL = env.NEXT_PUBLIC_CDN_URL;

export async function searchSpecs(query?: string, sort?: string): Promise<SearchResult> {
  const url = new URL(`${API_URL}/specs/search`);
  if (query) url.searchParams.set('q', query);
  if (sort) url.searchParams.set('sort', sort);

  const response = await fetch(url.toString(), {
    cache: 'no-store', // Always fresh data
  });

  if (!response.ok) {
    throw new Error(`Failed to search specs: ${response.statusText}`);
  }

  const data = await response.json();
  const parseResult = SearchResultSchema.safeParse(data);

  if (!parseResult.success) {
    throw new Error(`Invalid API response: ${parseResult.error.message}`);
  }

  return parseResult.data;
}

export async function getSpec(username: string, name: string): Promise<SpecMetadata> {
  const response = await fetch(`${API_URL}/specs/${username}/${name}`, {
    cache: 'no-store', // Always fresh data
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Spec not found');
    }
    throw new Error(`Failed to get spec: ${response.statusText}`);
  }

  const data = await response.json();
  const parseResult = SpecMetadataSchema.safeParse(data);

  if (!parseResult.success) {
    throw new Error(`Invalid API response: ${parseResult.error.message}`);
  }

  return parseResult.data;
}

export async function getReadme(s3Path: string): Promise<string> {
  const response = await fetch(`${CDN_URL}/${s3Path}/README.md`, {
    cache: 'no-store', // Always fresh content
  });

  if (!response.ok) {
    if (response.status === 404) {
      return '# No README available\n\nThis spec does not include a README file.';
    }
    throw new Error(`Failed to fetch README: ${response.statusText}`);
  }

  return response.text();
}
```

### Environment Configuration (Reused)

```bash
# Copy from apps/web/.env.development
PUBLIC_API_URL=http://localhost:4566  # LocalStack
PUBLIC_CDN_URL=http://localhost:4566  # LocalStack S3

# Copy from apps/web/.env.production
PUBLIC_API_URL=https://api.spectrl.pro
PUBLIC_CDN_URL=https://cdn.spectrl.pro
```

### Type-Safe Environment Validation

Using T3 Env for runtime validation and TypeScript safety:

```typescript
// lib/env.ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    // Server-side environment variables
    NODE_ENV: z.enum(['development', 'test', 'production']),
  },
  client: {
    // Client-side environment variables (must be prefixed with NEXT_PUBLIC_)
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_CDN_URL: z.string().url(),
  },
  // For Next.js >= 13.4.4, you only need to destructure client variables:
  experimental__runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  },
});
```

**Benefits:**

- **Type Safety**: Environment variables are typed and validated at build time
- **Runtime Validation**: Invalid environment variables cause build failures
- **IntelliSense**: Full autocomplete for environment variables
- **Documentation**: Self-documenting environment requirements

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

<function_calls>
<invoke name="prework">
<parameter name="featureName">launch-phase-4-website-nextjs

### Property Reflection

After analyzing the acceptance criteria, I identified several properties that can be consolidated to avoid redundancy:

- **Navigation properties** can be combined into comprehensive link generation tests
- **Responsive design properties** can be unified across different screen sizes
- **API validation properties** can be consolidated into comprehensive validation tests
- **Accessibility properties** can be grouped by WCAB compliance areas

### Core Properties

**Property 1: Search query parameter handling**
_For any_ search query from the landing page, the navigation URL should correctly encode the query parameter and direct to the spec discovery page
**Validates: Requirements 1.4**

**Property 2: Spec data rendering consistency**
_For any_ set of spec data returned by the API, the spec index page should display all specs with their complete metadata (name, description, version, tags)
**Validates: Requirements 2.1**

**Property 3: Search result filtering**
_For any_ search query and spec dataset, all returned results should match the query in either name or description fields
**Validates: Requirements 2.2**

**Property 4: Category filtering accuracy**
_For any_ selected category filter and spec dataset, all displayed results should belong to the selected category
**Validates: Requirements 2.3**

**Property 5: Sort order consistency**
_For any_ sort option (newest, popular, alphabetical) and spec dataset, the results should be ordered correctly according to the selected criteria
**Validates: Requirements 2.4**

**Property 6: Spec card navigation**
_For any_ spec card, the generated navigation link should correctly route to the spec detail page using the format `/specs/{username}/{name}`
**Validates: Requirements 2.5**

**Property 7: Version metadata display**
_For any_ spec with multiple versions, the spec detail page should display all versions with their complete metadata (version number, publish date, description)
**Validates: Requirements 3.1**

**Property 8: Version switching functionality**
_For any_ spec with multiple versions, selecting a different version should update all displayed information to reflect the selected version's data
**Validates: Requirements 3.2**

**Property 9: Markdown rendering consistency**
_For any_ valid markdown content, the README rendering should produce properly formatted HTML with correct heading hierarchy and styling
**Validates: Requirements 3.3**

**Property 10: Clipboard functionality**
_For any_ install command, clicking the copy button should successfully copy the exact command text to the user's clipboard
**Validates: Requirements 3.4**

**Property 11: Metadata completeness**
_For any_ spec, the detail page should display all available metadata fields (download counts, publish dates, agent tags) when present in the API response
**Validates: Requirements 3.5**

**Property 12: Documentation search relevance**
_For any_ search query in the documentation, all returned results should contain the search terms and be ranked by relevance
**Validates: Requirements 4.2**

**Property 13: Documentation navigation state**
_For any_ documentation page navigation, the sidebar should maintain the current page context and show the user's progress through the documentation
**Validates: Requirements 4.3**

**Property 14: Responsive design consistency**
_For any_ screen size below 768px, all interactive elements should maintain usability with appropriate touch targets and readable text
**Validates: Requirements 4.7, 5.4**

**Property 15: SEO metadata generation**
_For any_ page, the generated meta tags should include appropriate title, description, and Open Graph data based on the page content
**Validates: Requirements 5.2, 5.3**

**Property 16: API response validation**
_For any_ API response, the system should validate the data against the appropriate Zod schema and reject invalid responses with descriptive error messages
**Validates: Requirements 6.1**

**Property 17: Error handling consistency**
_For any_ API failure scenario, the system should provide graceful error handling with user-friendly messages and appropriate fallback content
**Validates: Requirements 6.2**

**Property 18: README fetching reliability**
_For any_ spec with a README file, the system should successfully fetch and display the content from the CDN, with graceful fallback for missing files
**Validates: Requirements 6.4**

**Property 19: Invalid data handling**
_For any_ invalid data encountered during processing, the system should log appropriate error information and display meaningful fallback content to users
**Validates: Requirements 6.5**

**Property 20: Keyboard navigation accessibility**
_For any_ page, keyboard navigation should provide logical tab order and clear focus indicators for all interactive elements
**Validates: Requirements 8.1**

**Property 21: Screen reader compatibility**
_For any_ page content, the HTML should include proper semantic structure and ARIA labels to ensure screen reader accessibility
**Validates: Requirements 8.2**

**Property 22: Color contrast compliance**
_For any_ text and background color combination, the contrast ratio should meet or exceed 4.5:1 for WCAG AA compliance
**Validates: Requirements 8.3**

**Property 23: Form validation clarity**
_For any_ form interaction, validation errors should be clearly communicated with specific, actionable error messages
**Validates: Requirements 8.4**

**Property 24: Touch target sizing**
_For any_ interactive element, the touch target should be at least 44px in both dimensions for mobile accessibility
**Validates: Requirements 8.5**

## Error Handling

- **API Failures**: Graceful degradation with user-friendly error messages
- **Network Issues**: Retry logic with exponential backoff for transient failures
- **Invalid Data**: Zod validation with detailed error logging and fallback content
- **404 Errors**: Custom error pages with helpful navigation options
- **Client-Side Errors**: Error boundaries to prevent application crashes

## Testing Strategy

### Dual Testing Approach

The system will use both unit testing and property-based testing for comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs using fast-check
- **Integration Tests**: Test component interactions and API integration
- **E2E Tests**: Validate complete user workflows

### Property-Based Testing Configuration

- **Library**: fast-check for TypeScript property-based testing
- **Iterations**: Minimum 100 iterations per property test
- **Test Tags**: Each property test tagged with format: **Feature: launch-phase-4-website-nextjs, Property {number}: {property_text}**
- **Coverage**: Each correctness property implemented as a single property-based test

### Testing Priorities

1. **API Integration**: Validate all external data with Zod schemas (following api-validation.md guidelines)
2. **User Interactions**: Test all navigation and form submissions
3. **Responsive Design**: Verify layout across different screen sizes
4. **Accessibility**: Automated testing with axe-core
5. **Performance**: Lighthouse CI for Core Web Vitals monitoring

## Deployment

### Vercel Configuration

```typescript
// next.config.mjs
import nextra from 'nextra';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
});

export default withNextra({
  // Next.js configuration
  experimental: {
    typedRoutes: true,
  },
  images: {
    domains: ['cdn.spectrl.pro'],
  },
});
```

### Build Process

1. Install dependencies: `pnpm install`
2. Validate environment variables with T3 Env
3. Build Next.js application: `pnpm build`
4. Deploy to Vercel: `vercel deploy`

### Environment Variables

Set in Vercel dashboard:

- `NEXT_PUBLIC_API_URL=https://api.spectrl.pro`
- `NEXT_PUBLIC_CDN_URL=https://cdn.spectrl.pro`

### Domain Configuration

- Primary domain: `spectrl.pro`
- SSL certificate auto-provisioned by Vercel
- Custom domain configured in Vercel dashboard

## Future Enhancements

### Phase 2 (Post-MVP)

- Advanced search with filters and facets
- Spec comparison tool
- User accounts and authentication
- Spec collections and favorites

### Phase 3 (Advanced)

- Real-time spec updates with WebSockets
- Collaborative spec editing
- Analytics dashboard
- API rate limiting and caching optimization
