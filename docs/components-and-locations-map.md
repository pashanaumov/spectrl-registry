# spectrl — Components & Locations Map

A quick, visual map of every moving part in spectrl: what it is, where it lives, and how they connect.

---

## Big Picture

```
┌─────────────────────────── User Machine ───────────────────────────┐
│                                                                   │
│  Project Workspace                                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ <repo>/                                                      │ │
│  │   .spectrl/                                                  │ │
│  │     index/            ──▶ intents (what the project wants)   │ │
│  │     lock/             ──▶ resolved graph (what it got)       │ │
│  │     config.json?      ──▶ project-scoped settings (optional) │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  User Local State                                                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ~/.spectrl/                                                  │ │
│  │   registry/                                                  │ │
│  │     catalog/        ──▶ package metadata index                │ │
│  │     blobs/          ──▶ content-addressed files (sha256/blake3)      │ │
│  │   config/           ──▶ global config (remotes, auth, policy) │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Tooling                                                          │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ spectrl (CLI)  ─────┐                                         │ │
│  │   resolver          ├─▶ reads project index + registries      │ │
│  │   installer         ├─▶ fetches to ~/.spectrl/registry        │ │
│  │   publisher         ├─▶ pushes to remote registry             │ │
│  │   inspector         └─▶ queries/prints graphs, manifests      │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘

               ▲                                             │
               │                                             ▼
┌────────────────────────────── Remotes / Network ──────────────────────────────┐
│                                                                               │
│  Remote Registry (optional)                                                   │
│    • catalog API  • blob store  • auth                                        │
│                                                                               │
│  Community/Org Indexes (optional)                                             │
│    • read-only catalogs your project may reference                            │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Terminology (crisp definitions)

- **Spec**: A versioned knowledge artifact (design, API, recipe) packaged for reuse.
- **Spec Package**: `name@version` + **manifest** + files (**blobs**). Immutable once published.
- **Manifest**: The package metadata and map of contents (type, entrypoints, deps, digests).
- **Blob**: File content stored by **content hash** (BLAKE3). Deduped across packages.
- **Registry**: Content store + catalog of spec packages.
  - **Local registry (user)**: `~/.spectrl/registry` — your machine-wide cache.
  - **Remote registry**: network store you can publish to / install from.

- **Project Index**: `<repo>/.spectrl/index/` — the project’s declared intents (what specs, ranges, sources, overrides).
- **Resolver**: Deterministic algorithm that turns intents into an exact resolution graph.
- **Lock**: `<repo>/.spectrl/lock/` — pinned digests/versions for reproducibility.
- **Policy/Overrides**: Rules for aliasing, preferring local/workspace, pinning, or replacing sources.
- **Workspace Link**: Symlink/alias to a local, editable spec package (use during dev).
- **Digest**: Content-addressed hash for a blob or package (e.g., BLAKE3).

---

## Where Things Live (paths)

```
Project (repo)
  .spectrl/
    index/             # intents (e.g., index.json, sources.json, overrides.json)
    lock/              # resolved graph (lock.json, graph.json)
    config.json        # optional, project-scoped config

User
  ~/.spectrl/
    registry/
      catalog/         # catalog db or shards (e.g., catalog.jsonl, sqlite)
      blobs/           # {algo}/{prefix}/{hash} content files
    config/            # auth, remotes, default policies
```

---

## Data Flow (install/resolve)

```
index/ (intents) ──▶ resolver ──▶ lock/ (exact graph) ──▶ installer
        ▲                                 │                  │
        │                                 ▼                  ▼
   project config                   local registry       remote registry
                                    (~/.spectrl)           (optional)
```

---

## Lifecycle: Common Operations

- **Init project**: create `.spectrl/index/` and optional `config.json`.
- **Add spec**: record intent in `index/`; resolver updates `lock/`.
- **Install**: fetch missing packages into `~/.spectrl/registry` (blobs + catalog).
- **Update**: change ranges/overrides in `index/`; re-resolve; refresh `lock/`.
- **Publish**: package + push to a remote registry; remote adds to catalog + blob store.
- **Inspect**: print manifest, deps, and the resolved graph.

---

## Minimal Command Mapping (illustrative)

```
# bootstrap
spectrl init

# declare + resolve
spectrl add <name>@<range>           # writes to .spectrl/index/
spectrl resolve                       # writes .spectrl/lock/

# materialize
spectrl install                       # populates ~/.spectrl/registry

# inspect
spectrl view spec <name>@<ver>
spectrl graph

# publish (optional)
spectrl publish --remote <id>
```

---

## Mental Model (npm analogy)

- **Project index** ≈ `package.json` (intents)
- **Lock** ≈ `package-lock.json` (pins)
- **Local registry** ≈ npm cache (machine-wide)
- **Remote registry** ≈ npmjs.com (optional)

---

## Design Principles

- **Local-first**: fully reproducible offline.
- **Content-addressed**: integrity by digest; dedupe by hash.
- **Deterministic**: same inputs → same graph/lock.
- **Separation of concerns**: project declares; registry stores; resolver decides.

---

## Optional: Editors & Agents

- **MCP bridge / agents**: read from project index + lock to propose/install specs.
- **Editors (Cursor, Kiro)**: consume manifests to scaffold code or docs.
