# TypeScript build migration

This document records the first migration stage. Application paths and entry
points subsequently changed; see [Architecture and deployment](architecture-and-deployment.md)
for the current layout, tests, CI, and production artifacts.

Operational instructions are maintained in the [runbook](runbook.md).

## Current package locations

| Package | Current location | Runtime or public entry point |
| --- | --- | --- |
| `@service-foundry/console` | `packages/apps/console` | `dist/main.js` |
| `@service-foundry/server` | `packages/services/server` | `dist/main.js` |
| `@service-foundry/shared` | `packages/services/shared` | `dist/index.js` and `dist/index.d.ts` |

The remaining sections preserve the first migration stage and its original names.

The project was subsequently named Service Foundry. Active packages now use
`@service-foundry/*`; the original names below describe the first migration stage.

This stage establishes version pins and TypeScript compilation for the existing
pnpm workspace. The package layout, HTTP routes, ports, and CommonJS runtime
behavior are preserved.

## Version pins

| Tool or dependency | Version | Configuration |
| --- | --- | --- |
| Node.js | 22.11.0 | `.nvmrc` and `.node-version` |
| Supported Node.js runtime | `>=22.11.0 <23` | Root `engines.node` |
| pnpm | 9.14.2 | Root `packageManager` and `engines.pnpm` |
| TypeScript | 5.9.3 | Root development dependency |
| Express | 4.22.1 | Both application dependencies |
| Express types | 4.17.25 | Both application development dependencies |
| Node.js types | 22.10.10 | Both application development dependencies |

Node.js and pnpm retain the original local toolchain versions. Express is pinned
to the version already resolved by the existing lockfile. The pnpm lockfile was
updated to include the compiler and type dependencies.

## Package changes

All three entry points moved from `index.js` to `src/index.ts`:

- `packages/console`: serves HTML at `/` on port 3000.
- `packages/server`: serves JSON at `/api/hello` on port 3001.
- `packages/shared`: exports the typed `greet(name: string): string` function.

The applications use TypeScript imports, which compile to CommonJS because each
package explicitly declares `type: commonjs`. All packages are marked private.
Application entry points now target `dist/index.js`. The shared package exposes
compiled JavaScript and declarations through `main`, `types`, and `exports`,
and declares `dist` as its packaged files directory.

The dependency graph remains:

```text
@monorepo/console -> @monorepo/shared
@monorepo/server  -> @monorepo/shared
```

Both applications continue to declare the shared dependency with `workspace:*`.

## Compiler configuration

`tsconfig.base.json` supplies strict checking, ES2022 output and library types,
NodeNext module and resolution settings, CommonJS interoperability, consistent
filename casing, and prevention of emission on compilation errors. It also
enables composite projects, declarations, declaration maps, and source maps.

Each package extends the base configuration and owns:

- `src` as its source directory.
- `dist` as its output directory.
- `dist/.tsbuildinfo` as its incremental build metadata.

The root `tsconfig.json` references all three projects. Each application also
references the shared project, allowing `tsc -b` to compile the library before
its consumers. The shared project has no ambient type packages; applications
explicitly include Node.js types.

## Commands

Activate the pinned Node.js version and enable Corepack with `corepack enable`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

| Command | Behavior |
| --- | --- |
| `pnpm build` | Compile the project graph incrementally with `tsc -b` |
| `pnpm clean` | Remove emitted files and build metadata with `tsc -b --clean` |
| `pnpm watch` | Continuously compile the graph with `tsc -b --watch` |
| `pnpm start` | Build, then start both applications in parallel |
| `pnpm --filter @monorepo/server build` | Build the API and its referenced library |
| `pnpm --filter @monorepo/server start` | Run the previously compiled API |

Watch mode recompiles files but does not restart running applications. Restart
the application to load updated output.

The root `.gitignore` excludes `node_modules`, `dist`, and TypeScript build
metadata. The README documents setup, compilation, and package extension rules.

## Verification performed

- Installation with `--frozen-lockfile` succeeded without lockfile changes.
- A clean followed by a full build succeeded.
- A subsequent verbose incremental build reported all projects up to date.
- Both compiled applications started under Node.js 22.11.0.
- The console endpoint returned HTTP 200 and included `Hello, User!`.
- The API endpoint returned HTTP 200 and included `Hello, API User!`.

The elevated package-manager launcher used Node.js 24.22.1 and emitted an engine
warning. Runtime endpoint checks used the pinned Node.js 22.11.0 executable.
Select the pinned Node.js version for normal development.

## Adding packages

Extend the base TypeScript configuration with package-local source, output, and
build metadata paths. Add the project to the root references. For every consumed
workspace library, declare both a `workspace:*` dependency in the manifest and a
TypeScript project reference in the consuming package.

At the end of this first stage, package separation, tests, CI, and deployment
artifacts were still planned. They have since been implemented using the current
nested package layout. Linting and formatting remain pending; see the current
architecture checklist for details.
