# Phase 4: Website - Design Document

## Overview

A lightweight, minimalistic website for Spectrl built with Astro and Starlight. The site features a monochrome aesthetic, fast performance, and seamless integration with the AWS backend API (LocalStack in development).

## Architecture

### Technology Stack

- **Framework**: Astro 4.x (hybrid rendering - SSG + SSR)
- **UI Components**: shadcn/ui with React integration
- **Documentation**: Starlight (Astro's official docs template)
- **Styling**: Tailwind CSS with monochrome color palette
- **Syntax Highlighting**: Shiki (built into Astro)
- **Markdown Rendering**: Astro's built-in markdown support
- **API Client**: Native fetch with Zod validation (server-side)
- **Deployment**: Vercel (with Functions for SSR)
- **Domain**: spectrl.pro

### Why Astro + shadcn/ui + Hybrid Rendering?

- **Lightweight**: Ships minimal JavaScript, only hydrates interactive components
- **Fast**: Hybrid rendering - static for content, SSR for dynamic data
- **SEO-friendly**: Server-rendered pages with proper meta tags
- **Simple**: File-based routing, minimal configuration
- **Starlight**: Production-ready documentation template out of the box
- **shadcn/ui**: Familiar, accessible components with React islands
- **Always fresh**: Dynamic pages always show latest data
- **Performance**: Excellent Lighthouse scores with selective hydration

### Project Structure

```
apps/web/
├── src/
│   ├── pages/
│   │   ├── index.astro              # Landing page
│   │   ├── specs/
│   │   │   ├── index.astro          # Spec index/browse
│   │   │   └── [username]/
│   │   │       └── [name].astro     # Spec detail page
│   │   └── docs/                    # Starlight documentation
│   │       ├── index.mdx
│   │       ├── getting-started.mdx
│   │       ├── cli-reference.mdx
│   │       └── spec-format.mdx
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── SearchBar.tsx            # shadcn Input (React island)
│   │   ├── SpecCard.tsx             # shadcn Card (React island)
│   │   ├── CodeBlock.astro
│   │   ├── ui/                      # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...                  # Other shadcn components
│   ├── lib/
│   │   ├── api-client.ts            # API integration with Zod
│   │   └── schemas.ts               # Zod schemas for API responses
│   └── styles/
│       └── global.css               # Tailwind + custom styles
├── public/
│   └── favicon.svg
├── astro.config.mjs
├── tailwind.config.mjs
├── components.json                  # shadcn/ui config
├── .env.development                 # LocalStack endpoints
├── .env.production                  # AWS production endpoints
└── package.json
```

## Design System

### Monochrome Color Palette

```css
--color-black: #000000;
--color-gray-900: #0a0a0a;
--color-gray-800: #1a1a1a;
--color-gray-700: #2a2a2a;
--color-gray-600: #3a3a3a;
--color-gray-500: #6a6a6a;
--color-gray-400: #9a9a9a;
--color-gray-300: #cacaca;
--color-gray-200: #e5e5e5;
--color-gray-100: #f5f5f5;
--color-white: #ffffff;
--color-accent: #2a2a2a;
```

### Typography

System font stack for performance with 8px-based type scale.

### Spacing

8px base unit system (0.5rem to 6rem).

## Components and Interfaces

### 1. Landing Page Components

#### Hero Component (Astro)

- Large headline and subtitle
- Syntax-highlighted install command
- Two CTAs using shadcn Button: "Get Started" and "Browse Specs"

#### SearchBar Component (React island)

- shadcn Input component with search icon
- Client-side navigation to spec index
- Keyboard accessible
- Debounced search

### 2. Spec Components

#### SpecCard Component (React island)

- shadcn Card component
- Displays spec metadata
- Install command with shadcn Button (copy functionality)
- Links to spec detail page
- Hover states and animations

### 3. shadcn/ui Components

Using shadcn/ui components as React islands:

- **Button**: CTAs, copy buttons, navigation
- **Card**: Spec cards, info sections
- **Input**: Search bars, filters
- **Select**: Sort and filter dropdowns
- **Badge**: Agent tags, version labels
- **Separator**: Visual dividers

### 4. Documentation Components

Starlight provides built-in components with monochrome theme customization.

## Data Models

### API Response Schemas

```typescript
// src/lib/schemas.ts
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

### Environment Configuration

```bash
# .env.development
PUBLIC_API_URL=http://localhost:4566  # LocalStack
PUBLIC_CDN_URL=http://localhost:4566  # LocalStack S3

# .env.production
PUBLIC_API_URL=https://api.spectrl.dev
PUBLIC_CDN_URL=https://cdn.spectrl.dev
```

### API Client

```typescript
// src/lib/api-client.ts
import { SpecMetadataSchema, SearchResultSchema } from './schemas';

const API_URL = import.meta.env.PUBLIC_API_URL;
const CDN_URL = import.meta.env.PUBLIC_CDN_URL;

export async function searchSpecs(query?: string): Promise<SearchResult> {
  const url = new URL(`${API_URL}/specs/search`);
  if (query) {
    url.searchParams.set('q', query);
  }

  const response = await fetch(url.toString());

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
  const response = await fetch(`${API_URL}/specs/${username}/${name}`);

  if (!response.ok) {
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
  const response = await fetch(`${CDN_URL}/${s3Path}/README.md`);

  if (!response.ok) {
    throw new Error(`Failed to fetch README: ${response.statusText}`);
  }

  return response.text();
}
```

### Hybrid Rendering Strategy

**Static pages (SSG):**

- Landing page (`/`) - content rarely changes, fast loading
- Documentation (`/docs/*`) - managed separately, can be static

**Server-rendered pages (SSR):**

- Spec index (`/specs`) - always fresh data, proper meta tags
- Spec detail (`/specs/:username/:name`) - dynamic meta tags, SEO-friendly

**Benefits:**

- Always up-to-date spec data (no rebuild needed)
- Proper SEO with dynamic meta tags
- Fast static pages where appropriate
- Simpler deployment (no webhooks or cache invalidation)
- Better social sharing (real Open Graph data)

**Page Configuration:**

```astro
---
// Static page (default)
export const prerender = true; // or omit (default)

// Server-rendered page
export const prerender = false;
---
```

**Server-side Data Fetching:**

```astro
---
// src/pages/specs/[username]/[name].astro
export const prerender = false;

const { username, name } = Astro.params;
const spec = await getSpec(username, name);
const readme = await getReadme(spec.versions[0].s3Path);
---

<head>
  <title>{spec.specName} by {spec.username} | Spectrl</title>
  <meta name="description" content={spec.versions[0].description} />
  <meta property="og:title" content={`${spec.specName} by ${spec.username}`} />
</head>
```

## Page Designs

### Landing Page (`/`)

- Header with logo and navigation
- Hero section with headline, subtitle, install command, CTAs (shadcn Buttons)
- Search bar (shadcn Input)
- "How It Works" section (3 steps)
- AI-Native callout
- Footer with links

**Note:** Featured specs removed for MVP - will add after recipes are written

### Spec Index Page (`/specs`)

- Header
- Search bar with sort and filter controls (shadcn Input, Select)
- Grid of spec cards (shadcn Card components)
- Loading state while fetching
- Empty state if no results
- Footer

### Spec Detail Page (`/specs/:username/:name`)

- Header
- Spec metadata (name, version dropdown with shadcn Select, install command with shadcn Button)
- Metadata row (downloads, published date, tags with shadcn Badge)
- Loading state while fetching
- Rendered README markdown
- Footer

### Documentation Pages (`/docs/*`)

Starlight's default layout with monochrome customization:

- Sidebar navigation (left)
- Main content (center)
- Table of contents (right)
- Search bar (top)

## Error Handling

- Graceful API error handling with fallbacks
- Custom 404 pages with helpful links
- Loading states with skeleton loaders
- Progressive enhancement (works without JS)

## Performance Optimization

- Static generation for all pages
- Astro's automatic code splitting
- Image optimization with Astro's `<Image>` component
- Minimal JavaScript bundle
- Static asset caching

## SEO Strategy

- Proper meta tags on all pages
- Open Graph tags for social sharing
- Auto-generated sitemap
- Structured data (Schema.org)
- Semantic HTML

## Accessibility

- WCAG AA compliance
- Semantic HTML elements
- Proper heading hierarchy
- Keyboard navigation
- Focus indicators
- 4.5:1 color contrast ratios
- ARIA labels where needed
- Screen reader support

## Deployment

### Vercel Configuration

```javascript
// vercel.json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "framework": "astro"
}
```

### Build Process

1. Install dependencies: `pnpm install`
2. Generate static pages: `pnpm build`
3. Deploy to Vercel: `vercel deploy`

### Environment Variables

Set in Vercel dashboard:

- `PUBLIC_API_URL` for production API (https://api.spectrl.pro)
- `PUBLIC_CDN_URL` for CloudFront

### Domain Configuration

- Primary domain: `spectrl.pro`
- Configure in Vercel dashboard
- Set up DNS records (A/CNAME)
- SSL certificate auto-provisioned by Vercel

## Testing Strategy

### Unit Tests

- API client functions (with MSW for mocking)
- Schema validation
- Utility functions

### Integration Tests

- Page rendering
- Component interactions
- API integration

### E2E Tests

- User flows (search, browse, view spec)
- Copy to clipboard functionality
- Navigation

### Performance Tests

- Lighthouse CI in GitHub Actions
- Bundle size monitoring
- Core Web Vitals tracking

## Future Enhancements

### Phase 2 (Post-MVP)

- Featured specs section on landing page
- Search modal in top nav (Cmd+K) using shadcn Dialog
- Advanced filtering by categories/tags
- Sort by popularity/downloads
- RSS feed for new specs

### Phase 3 (Advanced)

- Optimize to SSG with ISR for better performance
- Client-side search with Pagefind
- Spec comparison tool
- Dependency graph visualization
- User accounts and authentication

## Notes

- Keep it simple: Leverage Astro's simplicity with React islands for interactivity
- shadcn/ui: Use for all interactive components (buttons, inputs, cards, etc.)
- Monochrome aesthetic: Customize shadcn theme to match monochrome palette
- API validation: Always use Zod schemas for external data
- Client-side fetching: Use SWR or React Query for data fetching and caching
- Progressive enhancement: Core content accessible, enhanced with React islands
- Domain: spectrl.pro (configure in Vercel)
