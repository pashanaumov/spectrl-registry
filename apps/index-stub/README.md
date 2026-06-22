# index-stub

Minimal static index for testing Spectrl installation workflows.

## Purpose

This app provides a simple, static JSON index that maps spec names/versions to their manifests and source locations. It's used for:

- End-to-end testing of `spectrl install`
- Demonstrating how indexes work
- Local development without a remote registry

## Why This Exists

In MVP, Spectrl doesn't have a remote registry service. Instead, it uses static JSON files as indexes. This stub demonstrates:

1. **Index format**: Shows the exact structure of a valid index
2. **File URLs**: Uses `file://` URLs to reference local specs
3. **Offline operation**: Everything works without network access
4. **Testing**: Provides known-good data for e2e tests

## Structure

```
index-stub/
├── index.json           # Main index file
└── specs/               # Source specs referenced by index
    ├── example-spec/
    │   └── 1.0.0/
    │       ├── spectrl.json
    │       └── README.md
    └── base-spec/
        └── 0.5.0/
            ├── spectrl.json
            └── base.md
```

## Index Format

```json
{
  "example-spec@1.0.0": {
    "manifest": {
      "name": "example-spec",
      "version": "1.0.0",
      "deps": {},
      "files": ["README.md"]
    },
    "source": "file:./specs/example-spec/1.0.0"
  }
}
```

**Key points:**

- Keys are `{name}@{version}`
- Each entry has a `manifest` and `source`
- Source uses `file://` URLs (relative or absolute)
- Manifest is embedded (no need to fetch separately)

## Usage

### In E2E Tests

```bash
# Install from stub index
spectrl install example-spec --index ./apps/index-stub/index.json
```

### In Development

```bash
# Use stub as default index
export SPECTRL_INDEX=./apps/index-stub/index.json
spectrl install example-spec
```

## How It Works

1. CLI reads `index.json`
2. Looks up `example-spec@1.0.0` entry
3. Gets source: `file:./specs/example-spec/1.0.0`
4. Copies files from source to `.spectrl/registry/`
5. Recursively resolves dependencies

## Future Evolution

This stub demonstrates the index format that will eventually be served by:

- **Static hosting**: S3 + CloudFront serving JSON
- **Registry service**: API with search, versions, metadata
- **Layered catalogs**: Local + org + public indexes

But for MVP, a static JSON file is sufficient.

## Development

```bash
# No build step needed
# Just edit index.json and add specs
```

## Adding New Specs

1. Create spec directory: `specs/{name}/{version}/`
2. Add `spectrl.json` and tracked files
3. Add entry to `index.json`:

```json
{
  "new-spec@1.0.0": {
    "manifest": {
      "name": "new-spec",
      "version": "1.0.0",
      "deps": {},
      "files": ["README.md"]
    },
    "source": "file:./specs/new-spec/1.0.0"
  }
}
```

## No Dependencies

This is just static JSON and markdown files. No build process or dependencies.
