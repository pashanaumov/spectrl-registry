# Spectrl Schema Overview

## Index (the outermost container)

- A record/map where keys are strings like `"spec-name@1.0.0"`
- Values are `IndexEntry` objects
- Think of it as a "catalog" or "phone book" of available specs

## IndexEntry (individual catalog entry)

- `manifest`: The metadata about the spec (like package.json)
- `source`: Where to find the actual spec files (URL, could be `file://` or `https://`)

## Manifest (the spec's metadata)

- `name`: Spec identifier (e.g., "user-auth-spec")
- `version`: Semver version (e.g., "1.0.0")
- `deps`: What other specs this depends on
- `files`: Which files are included when you "install" this spec
- `hash`: Content fingerprint for integrity

## Concrete Example

```json
{
  "user-auth-spec@1.0.0": {
    "manifest": {
      "name": "user-auth-spec",
      "version": "1.0.0",
      "deps": { "base-security": "2.1.0" },
      "files": ["auth-requirements.md", "api-spec.yaml"],
      "hash": "abc123..."
    },
    "source": "file:./specs/user-auth-spec/1.0.0"
  }
}
```

## Summary

The index tells you "here's what specs are available and where to find them", the manifest tells you "here's what this specific spec contains and needs".
