# Initial monorepo analysis

This document records the analysis performed before implementation began on
November 15, 2026. Paths, configuration, and gaps below describe the original
repository, not its current state. For the implemented layout and status, see
[Architecture and deployment](architecture-and-deployment.md) and
[TypeScript build migration](typescript-build-migration.md).

The project was later named Service Foundry, and active packages now use the
`@service-foundry/*` scope. Original names below are retained as historical context.

The current workspace is organized under `packages/apps/*` and
`packages/services/*`. See the [runbook](runbook.md) for current setup and
operational commands; the original recommendations below are historical.

## Initial assessment

The repository was a small pnpm monorepo with a sensible initial dependency
graph, but it used JavaScript rather than TypeScript. There were no `.ts` files,
TypeScript dependencies, `tsconfig` files, or implemented build tasks.

The assessment used source and configuration inspection. No files were modified,
and builds and services were not run during the initial analysis.

## Original workspace structure

`pnpm-workspace.yaml` included every direct child of `packages/` using
`packages/*`.

| Package | Location | Role | Dependencies | Execution |
| --- | --- | --- | --- | --- |
| `@monorepo/console` | `packages/console` | Express application serving HTML at `/` | Express and shared library | `node index.js`, port 3000 |
| `@monorepo/server` | `packages/server` | Express API exposing `/api/hello` | Express and shared library | `node index.js`, port 3001 |
| `@monorepo/shared` | `packages/shared` | Exports the `greet()` utility | None | Loaded by both applications |

The console was itself a Node.js server; it did not call the API.

```text
@monorepo/console ──┬── express
                   └── @monorepo/shared

@monorepo/server ──┬── express
                  └── @monorepo/shared
```

Both applications declared `@monorepo/shared` using `workspace:*`. The lockfile
recorded local links to `../shared` and resolved both applications'
`express: ^4.18.0` declarations to version 4.22.1. There were no circular
dependencies.

All packages used CommonJS (`require` and `module.exports`), and each package's
`main` pointed directly to `index.js`. Only the root package was marked private;
the internal application and library packages lacked that publishing safeguard.

## Original build and execution configuration

| Command | Configuration | Implication |
| --- | --- | --- |
| `pnpm build` | `pnpm -r run build` | No workspace package defined `build`, so there was nothing to compile |
| `pnpm start` | `pnpm -r run start` | Ran the two application start scripts through recursive orchestration |

Recursive tasks normally follow dependency order. That works for finite build
tasks; persistent development servers should use explicit parallel execution as
the workspace grows. The two applications had no dependency on each other, so
they could run concurrently within pnpm's concurrency limit.

## Gaps identified

- No shared compiler configuration, type checking, tests, linting, or formatting
  configuration.
- No pinned pnpm version or declared supported Node.js version.
- No deployment configuration or CI workflow.
- Ports were hardcoded, and application creation and socket startup happened in
  the same files.

These are historical findings. The current gap checklist is maintained in
[Architecture and deployment](architecture-and-deployment.md#original-gap-checklist).

## Recommended architecture

Keep pnpm and introduce an explicit distinction between deployable applications
and reusable packages. The initial proposed layout was:

```text
apps/
  console/
    src/
      app.ts
      main.ts
  api/
    src/
      app.ts
      main.ts
      modules/
  worker/                 # When background processing is needed
    src/
packages/
  contracts/              # API/event schemas and inferred types
  config/                 # Environment parsing and validation
  observability/          # Logging and telemetry helpers
  domain/                 # Business rules genuinely shared by apps
  tsconfig/               # Shared compiler presets
tsconfig.json             # Build references
pnpm-workspace.yaml
package.json
pnpm-lock.yaml
```

The initial proposal used `apps/*` and `packages/*` workspace discovery. Create
shared packages only when a concrete consumer needs them; the existing greeting
utility did not justify creating all the proposed libraries immediately.

The implemented layout subsequently changed by request to
`packages/apps/console` and `packages/services/{server,shared}`. The package
boundary recommendations still apply:

- Applications can depend on shared packages; shared packages must not import
  application code.
- Keep dependencies acyclic and declare every runtime dependency in its
  consuming package.
- Import shared code through package names and explicit public exports. Avoid
  imports into another package's `src` directory.
- Keep business features inside their owning application until sharing has a
  clear benefit.
- Share API and event contracts where useful, including runtime validation
  schemas; TypeScript types alone cannot validate network payloads.
- Let independently deployed applications communicate through explicit APIs or
  events.

For each backend, separate `app.ts`, which constructs the Express application,
from `main.ts`, which validates configuration, starts listening, and handles
shutdown. This allows HTTP integration tests without automatically opening a
port when application code is imported.

## Recommended TypeScript build model

Start with compiled workspace libraries and TypeScript project references.

| Concern | Recommendation |
| --- | --- |
| Source/output | Each package owns `src/` and emits to its own `dist/` |
| Shared settings | Strict checking, source maps, consistent Node module settings |
| Libraries | Emit JavaScript and declaration files; expose `dist` through `exports` and `types` |
| Build graph | Root `tsc -b`, with project references following workspace dependencies |
| Incremental builds | Enable `composite` on referenced projects; keep build metadata package-local |
| Runtime | Start applications with `node dist/main.js` |

Project references give TypeScript an explicit compilation graph and allow
`tsc -b` to build dependencies in order. Workspace dependencies and TypeScript
references serve different purposes and must stay aligned.

For a new module convention, ESM with `"type": "module"` and matching NodeNext
compiler settings is reasonable. However, migrating to TypeScript while
retaining CommonJS first reduces the scope of the initial migration. Choose
consistently and verify emitted code runs directly in Node.

Keep the first build system simple: use TypeScript for compilation and pnpm for
package selection and scripts. Add a task cache or orchestrator when CI build
times and the number of applications justify the extra configuration.

For production, build and deploy each application independently with its
compiled workspace dependencies. Copying only an application's `dist/`
directory would omit required shared packages. pnpm provides isolated
deployment packaging, but its requirements vary by version, reinforcing the
need to pin pnpm.

## Proposed implementation stages

1. Establish version pins and TypeScript compilation.
2. Separate applications from shared libraries and define package exports.
3. Add tests, CI checks, and per-application deployment artifacts.

This approach preserves the existing dependency graph while giving additional
backends clear ownership and reproducible builds.

## Reference documentation

- [pnpm recursive execution](https://pnpm.io/cli/recursive)
- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [TypeScript module settings](https://www.typescriptlang.org/tsconfig/module.html)
- [pnpm deploy](https://pnpm.io/cli/deploy)
