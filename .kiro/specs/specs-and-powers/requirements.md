# Requirements Document

## Introduction

Spectrl currently treats all content as generic "specs." This feature introduces a type discriminator to split content into two categories: **specs** (static context documents that agents read for background knowledge) and **powers** (behavioral instructions that agents follow when performing tasks). This includes updating the manifest schema, extending the `spectrl new` CLI command with subcommands, generating a `catalog.md` discovery file during install, updating the AGENTS.md template, and enforcing description at publish time.

## Glossary

- **Manifest**: The `spectrl.jsonc` (or `spectrl.json` for legacy/registry content) file that defines a spec or power's metadata (name, version, type, description, dependencies, files, hash, agent info).
- **Spec**: A content type representing static context documents (PRDs, TDDs, ADRs, architecture decisions). Agents read specs for background knowledge.
- **Power**: A content type representing behavioral instructions (workflows, best practices, coding patterns). Agents follow powers when performing tasks.
- **Catalog**: The `.spectrl/catalog.md` file auto-generated during install that lists all installed specs and powers with their metadata for agent discovery.
- **Registry**: The local storage at `~/.spectrl/registry/{name}/{version}/` where published specs and powers are stored.
- **Project_Index**: The `spectrl-index.json` file tracking installed specs and powers in a project.
- **AGENTS_MD**: The `AGENTS.md` file that provides instructions to AI agents about how to use installed content.
- **CLI**: The `spectrl` command-line interface binary.
- **ManifestSchema**: The Zod schema in `packages/schema/src/manifest.ts` that validates manifest structure.
- **JSONC**: JSON with Comments — a superset of JSON that allows `//` and `/* */` comments. Used for human-readable config files.

## Requirements

### Requirement 1: Manifest Type Discriminator

**User Story:** As a spec author, I want to declare whether my content is a spec or a power, so that agents can distinguish between context documents and behavioral instructions.

#### Acceptance Criteria

1. THE ManifestSchema SHALL include a `type` field with allowed values `"spec"` and `"power"`.
2. WHEN a manifest omits the `type` field, THE ManifestSchema SHALL default the value to `"spec"`.
3. WHEN a manifest contains a `type` value other than `"spec"` or `"power"`, THE ManifestSchema SHALL reject the manifest with a validation error.
4. WHEN an existing manifest without a `type` field is parsed, THE ManifestSchema SHALL treat the manifest as type `"spec"` without requiring migration.

### Requirement 2: Scaffold Specs and Powers via CLI

**User Story:** As a developer, I want to scaffold new specs and powers from the command line, so that I can quickly create properly structured content of either type.

#### Acceptance Criteria

1. WHEN a user runs `spectrl new spec <name>`, THE CLI SHALL create a directory with a `spectrl.jsonc` manifest where `type` is `"spec"` and an empty `index.md` file.
2. WHEN a user runs `spectrl new power <name>`, THE CLI SHALL create a directory with a `spectrl.jsonc` manifest where `type` is `"power"` and an `index.md` file containing an instruction template.
3. WHEN a user runs `spectrl new <name>` without a subcommand, THE CLI SHALL default to creating a spec (equivalent to `spectrl new spec <name>`).
4. WHEN a user provides a name that does not match the pattern `^[a-z0-9-]+$`, THE CLI SHALL reject the name with a validation error.
5. WHEN a directory with the given name already exists, THE CLI SHALL reject the command with an error indicating the directory already exists.
6. WHEN `spectrl new` creates a `spectrl.jsonc` manifest, THE CLI SHALL include inline comments prompting the user to fill in the `description` field (required for publishing) and the `agent.purpose` and `agent.tags` fields (recommended for discoverability).

### Requirement 3: Catalog Generation During Install

**User Story:** As an AI agent, I want a single catalog file listing all installed content with metadata, so that I can efficiently discover relevant specs and powers without scanning the filesystem.

#### Acceptance Criteria

1. WHEN `spectrl install` completes successfully, THE CLI SHALL generate a `.spectrl/catalog.md` file listing all entries from the Project_Index.
2. THE Catalog SHALL include for each entry: name, version, type, description, and agent purpose (when available).
3. WHEN an installed manifest lacks an `agent.purpose` field, THE Catalog SHALL use the `description` field as a fallback for the purpose column.
4. WHEN an installed manifest lacks both `agent.purpose` and `description`, THE Catalog SHALL display an empty value for that entry's purpose.
5. WHEN a spec or power is uninstalled and `spectrl install` is re-run, THE Catalog SHALL reflect only the currently installed entries.
6. THE Catalog SHALL clearly label each entry as either "spec" or "power" in a type column.

### Requirement 4: AGENTS.md Template Update

**User Story:** As a project maintainer, I want the AGENTS.md template to reference the catalog and explain the spec/power distinction, so that AI agents understand how to use both content types.

#### Acceptance Criteria

1. THE AGENTS_MD template SHALL reference `.spectrl/catalog.md` as the primary discovery mechanism for installed content.
2. THE AGENTS_MD template SHALL explain that specs are static context documents that agents read for background knowledge.
3. THE AGENTS_MD template SHALL explain that powers are behavioral instructions that agents follow when performing tasks.
4. THE AGENTS_MD template SHALL instruct agents to consult the catalog first, then load only relevant content based on the current task.
5. WHEN `spectrl init` generates a new AGENTS.md, THE CLI SHALL use the updated template containing catalog references and type explanations.

### Requirement 5: Description Enforcement at Publish Time

**User Story:** As a registry maintainer, I want to require a description for all published content, so that the catalog and discovery tools have meaningful metadata to display.

#### Acceptance Criteria

1. WHEN a user runs `spectrl publish` and the manifest lacks a `description` field, THE CLI SHALL reject the publish with a hard error.
2. WHEN a user runs `spectrl publish` and the manifest lacks `agent.purpose` or `agent.tags`, THE CLI SHALL display a warning recommending the user add agent metadata for better discoverability, but allow the publish to proceed.
3. WHEN a user runs `spectrl new`, THE CLI SHALL create the manifest without a `description` value (description is not required at scaffold time, only at publish time).
4. WHEN a user runs `spectrl publish` and the `files` array in the manifest does not include `index.md`, THE CLI SHALL reject the publish with a hard error.

### Requirement 6: Backward Compatibility

**User Story:** As an existing spectrl user, I want my current specs to continue working without modification, so that adopting the new type system does not break my workflow.

#### Acceptance Criteria

1. WHEN the CLI encounters a manifest without a `type` field during install, THE CLI SHALL treat the manifest as type `"spec"`.
2. WHEN the CLI encounters a manifest without a `type` field during publish, THE CLI SHALL treat the manifest as type `"spec"`.
3. WHEN the Catalog is generated and an installed manifest lacks a `type` field, THE Catalog SHALL display the entry as type `"spec"`.
4. THE Registry SHALL store specs and powers in the same flat directory structure (`~/.spectrl/registry/{name}/{version}/`) regardless of type.
5. THE CLI SHALL install specs and powers to the same `.spectrl/specs/` directory regardless of type.

### Requirement 7: Manifest Serialization Round-Trip

**User Story:** As a developer, I want manifests to be reliably parsed and written without data loss, so that the type field and all metadata survive read-write cycles.

#### Acceptance Criteria

1. FOR ALL valid manifests, parsing a manifest with the ManifestSchema and then serializing the result back to JSON SHALL produce a value that re-parses to an equivalent manifest.
2. WHEN a manifest with `type: "power"` is published and then installed, THE installed manifest SHALL retain the `type: "power"` value.
3. WHEN a manifest with no `type` field is parsed and serialized, THE serialized output SHALL include `type: "spec"` (the default value).

### Requirement 8: JSONC Manifest Files

**User Story:** As a spec author, I want to add comments to my manifest files, so that I can document configuration choices and leave notes for collaborators.

#### Acceptance Criteria

1. WHEN `spectrl new` creates a manifest, THE CLI SHALL write the file as `spectrl.jsonc`.
2. WHEN the CLI reads a local manifest, THE CLI SHALL look for `spectrl.jsonc` first, then fall back to `spectrl.json` for backward compatibility.
3. WHEN a manifest file contains single-line comments (`//`), THE CLI SHALL parse the manifest successfully by stripping comments before validation.
4. WHEN a manifest file contains multi-line comments (`/* */`), THE CLI SHALL parse the manifest successfully by stripping comments before validation.
5. WHEN a manifest file contains trailing commas, THE CLI SHALL parse the manifest successfully.
6. WHEN a manifest file contains invalid content even after comment stripping, THE CLI SHALL reject the file with a descriptive parse error.
7. WHEN the CLI publishes to the registry, THE CLI SHALL store the manifest as standard JSON (`spectrl.json`) with comments stripped.
8. WHEN the CLI installs from the registry, THE CLI SHALL write the local manifest as `spectrl.json` (registry content is already standard JSON).

### Requirement 9: API Publish Endpoint Type Support

**User Story:** As a spec author, I want the publish API to accept and store the `type` field, so that specs and powers are correctly categorized in the public registry.

#### Acceptance Criteria

1. THE publish-spec API request schema SHALL include a `type` field in the manifest object with allowed values `"spec"` and `"power"`.
2. WHEN a publish request omits the `type` field, THE publish-spec API SHALL default the value to `"spec"`.
3. WHEN a spec is published, THE publish-spec API SHALL store the `type` value in the DynamoDB metadata record.
4. WHEN a publish request contains a `type` value other than `"spec"` or `"power"`, THE publish-spec API SHALL reject the request with a 400 validation error.

### Requirement 10: API Search Endpoint Type Support

**User Story:** As a developer, I want to filter search results by type, so that I can find only specs or only powers when browsing the registry.

#### Acceptance Criteria

1. THE search-specs API response schema SHALL include a `type` field in each search result.
2. WHEN the search-specs API maps DynamoDB items to search results, THE API SHALL pass through the `type` field from the stored metadata.
3. WHEN a DynamoDB item lacks a `type` field, THE search-specs API SHALL default the value to `"spec"` in the search result.
4. WHEN a `type` query parameter is provided (value `"spec"` or `"power"`), THE search-specs API SHALL filter results to only include items matching that type.
5. WHEN no `type` query parameter is provided, THE search-specs API SHALL return results of all types.

### Requirement 11: API Get-Spec Endpoint Type Support

**User Story:** As a frontend consumer, I want the get-spec API to return the `type` field per version, so that the detail page can display the content type.

#### Acceptance Criteria

1. THE get-spec API response SHALL include a `type` field in each version object.
2. WHEN a DynamoDB version item lacks a `type` field, THE get-spec API SHALL default the value to `"spec"` in the response.
3. WHEN a spec has versions with different types, THE get-spec API SHALL return the correct type for each individual version.

### Requirement 12: Frontend Type Display and Filtering

**User Story:** As a website visitor, I want to see whether content is a spec or a power, and filter by type, so that I can quickly find the kind of content I need.

#### Acceptance Criteria

1. THE SearchResultSchema in the frontend SHALL include a `type` field with allowed values `"spec"` and `"power"`, defaulting to `"spec"`.
2. THE SpecVersionSchema in the frontend SHALL include a `type` field with allowed values `"spec"` and `"power"`, defaulting to `"spec"`.
3. WHEN displaying a spec card in search results, THE frontend SHALL show a type badge indicating whether the item is a "spec" or "power".
4. WHEN displaying the spec detail page, THE frontend SHALL show a type badge next to the spec name.
5. THE specs search page SHALL provide a type filter (tabs or similar control) allowing users to filter by "All", "Specs", or "Powers".
6. WHEN a type filter is selected, THE frontend SHALL pass the `type` query parameter to the search API and display only matching results.
7. THE specs page title and description metadata SHALL mention both specs and powers.

### Requirement 13: Infrastructure Seed Data and Test Fixtures

**User Story:** As a developer, I want test fixtures and seed data to include the `type` field, so that local development and testing exercises the full type-aware flow.

#### Acceptance Criteria

1. THE test fixture at `infra/test-fixtures/test-spec.json` SHALL include a `type` field in the manifest object.
2. WHEN the seed data script generates specs, THE script SHALL randomly assign `type` as either `"spec"` or `"power"` to each generated item.
3. WHEN the seed data script writes DynamoDB items, THE script SHALL include the `type` field in each item.

### Requirement 14: E2E Test Coverage for Type Field

**User Story:** As a developer, I want E2E tests to verify that the type field flows correctly through publish and install, so that regressions are caught automatically.

#### Acceptance Criteria

1. WHEN a spec is published with `type: "power"`, THE E2E test SHALL verify the published manifest retains `type: "power"` in the registry.
2. WHEN a spec is published without a `type` field, THE E2E test SHALL verify the published manifest defaults to `type: "spec"` in the registry.
3. WHEN a JSONC manifest is published, THE E2E test SHALL verify the published manifest is stored as standard JSON with comments stripped.
4. WHEN a spec is installed, THE E2E test SHALL verify that `catalog.md` is generated in the `.spectrl/` directory.
5. WHEN a power is published and then installed, THE E2E test SHALL verify the type is preserved through the full publish-install cycle.

### Requirement 15: Documentation Updates

**User Story:** As a new user, I want the documentation to explain both specs and powers, so that I understand the full capabilities of spectrl.

#### Acceptance Criteria

1. THE CLI reference documentation SHALL document `spectrl new spec <name>` and `spectrl new power <name>` commands.
2. THE CLI reference documentation SHALL mention the `type` field in the `spectrl publish` section.
3. THE introduction documentation SHALL explain the distinction between specs and powers.
4. THE getting-started documentation SHALL include an example of creating a power alongside the existing spec example.

### Requirement 16: Cross-Type Dependency Prohibition

**User Story:** As a spec author, I want the CLI to prevent me from declaring a dependency on content of a different type, so that the dependency graph remains semantically coherent (specs depend on specs, powers depend on powers).

#### Acceptance Criteria

1. WHEN a user runs `spectrl publish` and the manifest declares a dependency whose installed type differs from the parent manifest's type, THE CLI SHALL reject the publish with a hard error.
2. WHEN a `spec` manifest lists a dependency that resolves to a `power`, THE CLI SHALL reject the publish with a hard error indicating the type mismatch.
3. WHEN a `power` manifest lists a dependency that resolves to a `spec`, THE CLI SHALL reject the publish with a hard error indicating the type mismatch.
4. WHEN a manifest has no dependencies, THE CLI SHALL not perform cross-type dependency checks.
5. WHEN a dependency cannot be resolved (not found in the local registry), THE CLI SHALL skip the cross-type check for that dependency and allow existing resolution errors to surface normally.
