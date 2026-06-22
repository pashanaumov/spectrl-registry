# Implementation Plan: Specs and Powers

## Overview

Implement the specs/powers type discriminator, JSONC manifest support, CLI scaffolding subcommands, catalog generation, AGENTS.md template update, and publish-time validation. Then extend the type field across the full stack: API Lambda functions (publish, search, get-spec), frontend web app (schemas, components, filtering), infrastructure (seed data, test fixtures), E2E tests, and documentation. Changes span `@spectrl/schema`, `@spectrl/core`, `@spectrl/cli`, `api/`, `apps/spectrl-web/`, `infra/`, `tests/e2e/`, and docs.

## Tasks

- [x] 1. Add `type` field to ManifestSchema
  - [x] 1.1 Update `ManifestSchema` in `packages/schema/src/manifest.ts` to add `type: z.enum(['spec', 'power']).default('spec')` field
    - Place after `version` field
    - Update the exported `Manifest` type (auto-derived via `z.infer`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3_
  - [x] 1.2 Write property tests for ManifestSchema type field in `packages/schema/src/manifest.test.ts`
    - **Property 1: Invalid type rejection** — for any string not in {"spec", "power"}, schema rejects
    - **Property 2: Manifest round-trip** — parse → serialize → parse produces equivalent manifest
    - **Property 3: Default type materialization** — missing type → "spec" after parse+serialize
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3**
    - Install `fast-check` as dev dependency in schema package

- [x] 2. Add JSONC parsing and manifest resolution to core
  - [x] 2.1 Add `jsonc-parser` dependency to `packages/core/package.json` and create `packages/core/src/jsonc.ts`
    - Export `parseJsoncString(content: string): unknown` that strips comments and trailing commas
    - Throw descriptive error on invalid content
    - _Requirements: 8.3, 8.4, 8.5, 8.6_
  - [x] 2.2 Write property test for JSONC parser in `packages/core/src/jsonc.test.ts`
    - **Property 8: JSONC parsing equivalence** — valid JSON with injected comments/trailing commas parses to same value
    - **Validates: Requirements 8.3, 8.4, 8.5**
  - [x] 2.3 Create `packages/core/src/manifest-file.ts` with manifest filename resolution
    - Export `resolveManifestPath(dir: string): Promise<string>` — checks `spectrl.jsonc` first, falls back to `spectrl.json`
    - Export `readManifestFile(dir: string): Promise<unknown>` — resolves path, reads file, parses as JSONC
    - Export manifest filename constants (`MANIFEST_JSONC`, `MANIFEST_JSON`)
    - _Requirements: 8.2, 8.6_
  - [x] 2.4 Write property test for manifest resolution in `packages/core/src/manifest-file.test.ts`
    - **Property 9: JSONC manifest resolution** — prefers .jsonc over .json, falls back correctly
    - **Validates: Requirements 8.2**
  - [x] 2.5 Update `packages/core/src/index.ts` to export new modules
    - Export from `jsonc.ts` and `manifest-file.ts`

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update CLI utils for JSONC-aware manifest reading
  - [x] 4.1 Update `packages/cli/src/utils.ts` to use JSONC-aware manifest resolution
    - Change `getManifestPath` to async, use `resolveManifestPath` from core
    - Update `readAndValidateManifest` to use `readManifestFile` from core
    - Update `readJsonFile` to handle JSONC content
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 4.2 Update all call sites of `getManifestPath` and `readAndValidateManifest` to handle async
    - Update `packages/cli/src/commands/publish/index.ts`
    - Update any other files that call these functions
    - _Requirements: 8.2_

- [x] 5. Refactor `spectrl new` command for spec/power subcommands
  - [x] 5.1 Refactor `packages/cli/src/commands/new/index.ts`
    - Rename `newSpec` to `newContent(name, cwd, type, version, description)`
    - Accept `type: 'spec' | 'power'` parameter
    - Write `spectrl.jsonc` instead of `spectrl.json`
    - Include inline JSONC comments prompting for description and agent metadata
    - Create `index.md` (instruction template for specs, instruction template for powers)
    - Add `"index.md"` to the `files` array in the manifest
    - Set `type` field in the manifest
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 5.3, 8.1_
  - [x] 5.2 Update `packages/cli/src/cli.ts` command routing
    - Replace single `newCmd` with subcommand group (`spec`, `power`)
    - Handle backward compat: `spectrl new <name>` defaults to spec
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 5.3 Write property test for scaffold output in `packages/cli/src/commands/new/index.test.ts`
    - **Property 4: Scaffold output correctness** — correct type, .jsonc filename, index.md, inline comments
    - **Property 5: Invalid name rejection** — names not matching pattern are rejected
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6, 5.3, 8.1**
  - [x] 5.4 Update `packages/cli/src/commands/index.ts` exports
    - Export `newContent` instead of `newSpec` (or both for backward compat)
    - _Requirements: 2.1_

- [x] 6. Add publish-time validation
  - [x] 6.1 Update `packages/cli/src/commands/publish/index.ts` with new validation
    - Hard error if `description` is missing or empty (both local and public paths)
    - Hard error if `files` array does not include `index.md`
    - Warning if `agent`, `agent.purpose`, or `agent.tags` are missing
    - Move existing public-only description check to shared validation
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 6.2 Write unit tests for publish validation in `packages/cli/src/commands/publish/index.test.ts`
    - Test missing description → hard error
    - Test missing index.md → hard error
    - Test missing agent metadata → warning, publish proceeds
    - **Property 7: Publish description enforcement**
    - **Validates: Requirements 5.1, 5.2, 5.4**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7.5 Add cross-type dependency validation at publish time
  - [x] 7.5.1 Update `packages/cli/src/commands/publish/index.ts` to validate dependency types
    - After reading the manifest, iterate over `manifest.deps` entries
    - For each dependency, look up its manifest in the local registry (`~/.spectrl/registry/{name}/`)
    - If the resolved dependency's `type` differs from the parent manifest's `type`, throw a `CLIError` with a descriptive message (e.g. `"Dependency 'foo' is a power but parent is a spec — cross-type dependencies are not allowed"`)
    - Skip the check if the dependency is not found in the local registry (let normal resolution errors surface)
    - Add this check inside `validateManifestForPublish` or as a separate async validation step called before the destination prompt
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  - [x] 7.5.2 Write unit tests for cross-type dependency validation in `packages/cli/src/commands/publish/index.test.ts`
    - Test spec depending on power → hard error
    - Test power depending on spec → hard error
    - Test spec depending on spec → allowed
    - Test power depending on power → allowed
    - Test missing dependency in registry → no error from type check
    - Test manifest with no deps → no error
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 8. Implement catalog generation
  - [x] 8.1 Create `packages/cli/src/catalog/generator.ts`
    - Define `CatalogEntry` interface
    - Implement `generateCatalogMarkdown(entries: CatalogEntry[]): string` — produces markdown table
    - Implement `generateCatalog(cwd: string): Promise<void>` — reads index, reads manifests, writes `.spectrl/catalog.md`
    - Fallback logic: purpose → description → empty string
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 8.2 Write property test for catalog generation in `packages/cli/src/catalog/generator.test.ts`
    - **Property 6: Catalog content correctness** — all fields present with correct fallback logic
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
  - [x] 8.3 Integrate catalog generation into `packages/cli/src/commands/install/index.ts`
    - Call `generateCatalog(cwd)` after successful install (both single spec and full install)
    - _Requirements: 3.1, 3.5_

- [x] 9. Update AGENTS.md template
  - [x] 9.1 Update `packages/cli/src/agents/template.ts`
    - Rewrite `AGENTS_TEMPLATE` to reference `.spectrl/catalog.md` for discovery
    - Explain spec vs power distinction
    - Instruct agents to consult catalog first, then lazy-load relevant content
    - Remove old "scan `.spectrl/specs/` directory" instructions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 9.2 Write unit tests for AGENTS.md template in `packages/cli/src/agents/template.test.ts`
    - Verify template contains catalog.md reference
    - Verify template explains spec and power types
    - Verify template instructs catalog-first discovery
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 10. Update existing tests for backward compatibility
  - [x] 10.1 Update existing test fixtures that reference `spectrl.json` filename
    - Update `packages/cli/src/commands/new/index.test.ts` for `.jsonc` output
    - Update `packages/cli/src/commands/publish/index.test.ts` for JSONC-aware reading
    - Ensure tests with legacy `spectrl.json` manifests still pass (backward compat)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.7, 8.8_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Update API publish-spec endpoint for type support
  - [x] 12.1 Add `type` field to `api/publish-spec/schemas/request.ts`
    - Add `type: z.enum(['spec', 'power']).default('spec')` to the manifest object in `publishRequestSchema`
    - Note: API uses `zod/v4`
    - _Requirements: 9.1, 9.2, 9.4_
  - [x] 12.2 Add `type` field to `api/publish-spec/schemas/dynamodb.ts`
    - Add `type: z.enum(['spec', 'power']).default('spec')` to `specMetadataSchema`
    - _Requirements: 9.3_
  - [x] 12.3 Update `api/publish-spec/index.ts` handler to pass `type` through to `storeSpecMetadata`
    - Add `type: manifest.type` to the metadata object passed to `storeSpecMetadata`
    - _Requirements: 9.3_
  - [x] 12.4 Write unit tests for publish-spec type support in `api/publish-spec/index.test.ts`
    - Test that publishing with `type: "power"` stores type in DynamoDB
    - Test that publishing without `type` defaults to `"spec"` in DynamoDB
    - Test that invalid `type` value returns 400
    - Use `aws-sdk-client-mock` for DynamoDB mocking
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 13. Update API search-specs endpoint for type support
  - [x] 13.1 Add `type` field to `api/search-specs/schemas/response.ts`
    - Add `type: z.enum(['spec', 'power']).default('spec')` to `searchResultSchema`
    - _Requirements: 10.1_
  - [x] 13.2 Add optional `type` query parameter to `api/search-specs/schemas/request.ts`
    - Add `type: z.enum(['spec', 'power']).optional()` to `searchQuerySchema`
    - _Requirements: 10.4, 10.5_
  - [x] 13.3 Update `api/search-specs/helpers/dynamodb.ts` for type passthrough and filtering
    - Update `mapToSearchResult` to include `type: item.type || 'spec'`
    - Update `reverseMapSearchResult` to include `type`
    - Add `type` to `SearchSpecsParams` interface
    - Add type filter logic to the filtering step (alongside existing query filter)
    - _Requirements: 10.2, 10.3, 10.4, 10.5_
  - [x] 13.4 Update `api/search-specs/index.ts` handler to extract and pass `type` query parameter
    - Extract `type` from validated query params
    - Pass `type` to `searchSpecs` call
    - _Requirements: 10.4, 10.5_
  - [x] 13.5 Write property tests for search type mapping and filtering in `api/search-specs/index.test.ts`
    - **Property 10: Search result type mapping correctness** — DynamoDB items with/without type map correctly
    - **Property 11: Search type filter correctness** — filter returns only matching types
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

- [x] 14. Update API get-spec endpoint for type support
  - [x] 14.1 Add `type` field to `api/get-spec/schemas/response.ts`
    - Add `type: z.enum(['spec', 'power']).default('spec')` to `specVersionSchema`
    - _Requirements: 11.1_
  - [x] 14.2 Update `api/get-spec/index.ts` handler to include `type` in transformed versions
    - Add `type: v.type` to the `transformedVersions` mapping
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 14.3 Update `api/get-spec/helpers/dynamodb.ts` to pass `type` through in version mapping
    - Add `type: item.type || 'spec'` to the `specVersionSchema.parse()` call
    - _Requirements: 11.2_
  - [x]14.4 Write property test for get-spec version type mapping in `api/get-spec/index.test.ts`
    - **Property 12: Get-spec version type mapping correctness** — versions with/without type map correctly
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 15. Checkpoint - Ensure all API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Update infrastructure test fixtures and seed data
  - [x] 16.1 Update `infra/test-fixtures/test-spec.json` to include `type` field
    - Add `"type": "spec"` to the manifest object
    - _Requirements: 13.1_
  - [x] 16.2 Update `infra/seed-dev-data.sh` to generate specs and powers
    - Add `TYPES=("spec" "power")` array
    - Randomly assign type in `generate_spec` function
    - Include `"type": {"S": "$type"}` in DynamoDB items
    - Include `"type": "$type"` in manifest JSON
    - Apply same changes to `generate_additional_version`
    - _Requirements: 13.2, 13.3_

- [x] 17. Update frontend schemas for type support
  - [x] 17.1 Add `type` field to frontend schemas in `apps/spectrl-web/src/lib/schemas.ts`
    - Add `type: z.enum(['spec', 'power']).default('spec')` to `SearchResultSchema`
    - Add `type: z.enum(['spec', 'power']).default('spec')` to `SpecVersionSchema`
    - Note: Frontend uses `zod` v3 (not `zod/v4`)
    - _Requirements: 12.1, 12.2_
  - [x] 17.2 Write unit tests for frontend schemas in `apps/spectrl-web/src/lib/schemas.test.ts`
    - Test that SearchResultSchema accepts type field and defaults to "spec"
    - Test that SpecVersionSchema accepts type field and defaults to "spec"
    - _Requirements: 12.1, 12.2_

- [x] 18. Update frontend components for type display
  - [x] 18.1 Update `apps/spectrl-web/src/components/specs/spec-card.tsx` to show type badge
    - Add a Badge component showing "spec" or "power"
    - Use `variant="default"` for powers, `variant="outline"` for specs
    - _Requirements: 12.3_
  - [x] 18.2 Update `apps/spectrl-web/src/components/specs/spec-detail.tsx` to show type badge
    - Add type badge next to the spec name in the header
    - Use same badge styling as spec-card
    - _Requirements: 12.4_
  - [x] 18.3 Update `apps/spectrl-web/src/components/specs/specs-search.tsx` to add type filter tabs
    - Add tab-style filter with "All", "Specs", "Powers" options
    - Read current filter from URL search params (`type` param)
    - Update URL when filter changes (preserve existing query)
    - _Requirements: 12.5, 12.6_
  - [x] 18.4 Update `apps/spectrl-web/src/app/specs/page.tsx` for type-aware metadata and API calls
    - Update page title to "Browse Specs & Powers"
    - Update description to mention both specs and powers
    - Extract `type` from search params and pass to `searchSpecs` API call
    - _Requirements: 12.7, 12.6_
  - [x] 18.5 Update `apps/spectrl-web/src/lib/api-client.ts` to accept `type` parameter
    - Add optional `type` parameter to `searchSpecs` function
    - Pass `type` as query parameter in the API request URL
    - _Requirements: 12.6_
  - [x] 18.6 Write unit tests for frontend components
    - Test spec-card renders type badge with correct text
    - Test spec-detail renders type badge
    - Test specs-search renders type filter tabs
    - Use `@testing-library/react` for component tests
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 19. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Add E2E tests for type-aware publish and install
  - [x] 20.1 Add E2E publish tests for type field in `tests/e2e/publish.test.ts`
    - Test publishing with explicit `type: "power"` retains type in registry manifest
    - Test publishing without `type` field defaults to `"spec"` in registry manifest
    - Test publishing JSONC manifest stores standard JSON in registry
    - _Requirements: 14.1, 14.2, 14.3_
  - [x] 20.2 Add E2E install tests for catalog and type preservation in `tests/e2e/install.test.ts`
    - Test that `catalog.md` is generated in `.spectrl/` after install
    - Test that type is preserved through publish → install cycle for powers
    - _Requirements: 14.4, 14.5_

- [x] 21. Update documentation
  - [x] 21.1 Update `apps/spectrl-web/src/content/docs/cli-reference.mdx`
    - Document `spectrl new spec <name>` and `spectrl new power <name>` commands
    - Mention `type` field in `spectrl publish` section
    - _Requirements: 15.1, 15.2_
  - [x] 21.2 Update `apps/spectrl-web/src/content/docs/introduction.mdx`
    - Add section explaining specs vs powers distinction
    - Explain that specs are static context, powers are behavioral instructions
    - _Requirements: 15.3_
  - [x] 21.3 Update `apps/spectrl-web/src/content/docs/getting-started.mdx`
    - Add power creation example alongside existing spec example
    - Show `spectrl new power <name>` command
    - _Requirements: 15.4_

- [x] 22. Final full-stack checkpoint - Ensure all tests pass
  - Ensure all tests pass across packages, API, frontend, and E2E, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Build bottom-up: schema → core → CLI → API → infra → frontend → E2E → docs
- Tasks marked with `*` are optional and can be skipped for faster MVP
- API uses `zod/v4` while frontend and packages use `zod` v3 — keep this distinction
- Use `aws-sdk-client-mock` for API DynamoDB mocking in tests
- Use `@testing-library/react` for frontend component tests
- Use MSW for HTTP mocking in frontend tests (never override `global.fetch`)
