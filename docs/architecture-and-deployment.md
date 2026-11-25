# Architecture, tests, and deployment

Current Service Foundry architecture, reviewed November 16, 2026. For operational
commands and troubleshooting, see the [runbook](runbook.md). Historical layouts
are recorded separately in the [initial analysis](initial-monorepo-analysis.md)
and [first migration stage](typescript-build-migration.md).

Deployable applications and reusable libraries have separate package boundaries,
using the `@service-foundry/*` package scope and CommonJS module format. The API lives
under `packages/services/server`; directory placement does not determine package role.

## Workspace boundaries

```text
packages/
  apps/
    console/         @service-foundry/console: HTML server
      src/app.ts     Application factory and routes
      src/main.ts    Runtime configuration, listening, and shutdown
      test/          HTTP integration tests
      Dockerfile     Independent production image
  services/
    server/          @service-foundry/server: JSON API
      src/app.ts
      src/main.ts
      test/
      Dockerfile
    shared/          @service-foundry/shared: reusable greeting function
      src/index.ts   Public library exports
      src/schemaCheck.ts  Internal source, not publicly exported
      test/          Public-export and interoperability tests
scripts/
  smoke-deployment.cjs
.github/workflows/
  ci.yml
tsconfig.base.json   Shared strict compiler options
tsconfig.json        Root build references
pnpm-workspace.yaml  Workspace discovery
```

The workspace discovers `packages/apps/*` and `packages/services/*`. Applications depend on the
shared library through `workspace:*` and reference it in their TypeScript
projects. Root project references point to the new application locations.

```text
@service-foundry/console -> @service-foundry/shared
@service-foundry/server  -> @service-foundry/shared
```

Both applications also depend on Express 4.22.1. Shared has no runtime
dependencies. The console renders its own HTML and does not call the API.
The reusable public API is currently `greet(name: string): string`; internal
source files do not become public merely because they compile to `dist`.

Applications own their HTTP behavior and startup. `src/app.ts` exports
`createApp()` without opening a socket; `src/main.ts` validates the port, starts
the server, and handles SIGTERM/SIGINT with a ten-second shutdown deadline.
Application manifests are private and package only `dist`, with
`dist/main.js` as their runtime entry point. They are executables, not shared
library APIs.

The shared library's existing explicit `exports` map is the public API. It
supports CommonJS and ESM consumers and exposes declaration files. Imports of
internal paths such as `@service-foundry/shared/dist/index.js` are blocked. Add new
public exports deliberately instead of importing another package's source.

Keep dependencies acyclic: applications may consume libraries, libraries must
not import applications, and applications should not import one another.
Introduce additional libraries only when there is a concrete sharing need.

## TypeScript build model status

All recommendations in the initial TypeScript build model are implemented.

| Concern | Status | Implementation |
| --- | --- | --- |
| Source and output | Implemented | Each package owns `src/` and emits to its own `dist/` |
| Shared compiler settings | Implemented | `tsconfig.base.json` enables strict checking, source maps, and consistent NodeNext module settings |
| Compiled library API | Implemented | Shared emits JavaScript and declarations; its manifest exposes `dist` through `exports` and `types` |
| Build graph | Implemented | Root `pnpm build` runs `tsc -b` with references to all three projects |
| Dependency alignment | Implemented | Both applications declare `@service-foundry/shared: workspace:*` and corresponding TypeScript references |
| Incremental builds | Implemented | Referenced projects inherit `composite: true` and keep metadata in package-local `dist/.tsbuildinfo` |
| Runtime entry points | Implemented | Both applications start with `node dist/main.js` |
| Module convention | Implemented | Every package explicitly declares `type: commonjs`; NodeNext compilation preserves CommonJS output |
| Build tooling | Implemented | TypeScript handles compilation; pnpm handles scripts and package selection |
| Independent production packaging | Implemented | Each application builds separately and uses `pnpm deploy --prod` to include compiled workspace dependencies |
| Version pins | Implemented | Node.js 22.11.0, pnpm 9.14.2, TypeScript 5.9.3, and direct dependencies are pinned |

Project references determine TypeScript compilation order; `workspace:*`
dependencies determine package installation and runtime resolution. Keep both
declarations aligned when adding shared dependencies. Both applications
reference the shared library, so it compiles before its consumers.

ESM migration remains optional. The current CommonJS output runs directly in
Node.js, and the public shared-library entry point supports ESM consumers.
A task cache or orchestrator also remains optional; introduce one when measured
build times and workspace size justify the additional configuration.

## Original gap checklist

| Original gap | Status | Implementation or remaining work |
| --- | --- | --- |
| Shared compiler configuration | Resolved | All packages extend the root compiler configuration |
| Type checking | Resolved | `tsc -b` checks types during builds; `pnpm check` performs a clean build and tests |
| Tests | Resolved | Nine tests cover application responses, health routes, 404s, and shared exports |
| Linting | Missing | No linter dependency, configuration, or script |
| Formatting | Missing | No formatter dependency, configuration, or check |
| Pinned pnpm version | Resolved | Root `packageManager` and `engines.pnpm` pin 9.14.2 |
| Declared Node.js support | Resolved | `engines.node` declares `>=22.11.0 <23`; `.nvmrc` and `.node-version` pin 22.11.0 |
| Deployment configuration | Resolved | Per-application Dockerfiles and isolated production bundle commands |
| CI workflow | Resolved | GitHub Actions configures clean builds, tests, packaging, and container checks |
| Hardcoded ports | Resolved | Both applications accept validated `PORT` and configurable `HOST`, with default values |
| Combined creation and startup | Resolved | `app.ts` creates each application; `main.ts` opens the socket and handles shutdown |

The implementation covers all three planned stages: version pins and TypeScript
compilation; package boundaries and public exports; tests, CI configuration, and
per-application deployment artifacts. Linting and formatting are still pending.
Configured CI and container checks are distinct from observed execution; see
the verification section below for validation limits.

## Runtime configuration

| Variable | Default | Behavior |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Listening interface |
| `PORT` | Console: 3000; API: 3001 | Integer from 0 to 65535; zero assigns an available port |

Both applications expose `GET /health` returning `{"status":"ok"}`. This is
a process health endpoint, not a check of external dependencies. Original
routes remain `/` for the console and `/api/hello` for the API.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm start
```

`pnpm check` cleans, compiles the full TypeScript graph, and runs all tests.
`pnpm test` builds incrementally before testing. Tests use Node's built-in
runner and CommonJS test files against compiled TypeScript output; no additional
test framework is required.

The suite covers each application's HTTP response, health route, and 404
behavior using ephemeral loopback ports. Shared-library tests verify greetings,
blocked internal imports, and ESM loading through the public export.

To test one package, build first, then run its filtered test script:

```sh
pnpm build
pnpm --filter @service-foundry/server test
```

## Production directories

```sh
pnpm deploy:console
pnpm deploy:server
node scripts/smoke-deployment.cjs artifacts/console console
node scripts/smoke-deployment.cjs artifacts/server server
```

Each deployment command builds the selected application and its referenced
library, then uses pnpm 9's `deploy --prod` to populate `artifacts/<app>` with
compiled files and isolated production dependencies, including the shared
library. The result does not rely on workspace source or workspace symlinks.
Use an empty target directory when generating a fresh deployment.

Run a deployed application from its directory with `node dist/main.js`.
Set environment variables through the shell or deployment platform. Generated
artifacts are excluded from version control. For applications that later add
native dependencies, build artifacts on the target operating system and
architecture; do not copy Windows dependencies to Linux.

## Containers

Build from the repository root so Docker can access the entire workspace:

```sh
docker build -f packages/apps/console/Dockerfile -t service-foundry-console .
docker build -f packages/services/server/Dockerfile -t service-foundry-server .
docker run --rm -p 3000:3000 service-foundry-console
docker run --rm -p 3001:3001 service-foundry-server
```

Each application has a multistage Dockerfile using Node.js 22.11.0 and pnpm
9.14.2. The build stage installs the frozen lockfile, compiles the selected
project graph, and creates a production deployment directory. The runtime
stage copies only that directory, runs as the `node` user, and defines an HTTP
health check. TypeScript, tests, and workspace source are not runtime inputs.
The root `.dockerignore` excludes local dependencies, build output, generated
artifacts, and editor metadata.

## CI

The GitHub Actions workflow runs on pushes and pull requests with read-only
repository permissions. It installs the pinned Node and pnpm versions and
validates the frozen lockfile before a clean build and test run.

After checks pass, a matrix independently packages each application, smoke tests
its isolated production directory, and uploads a `.tar.gz` deployment artifact.
Archiving preserves dependency symlinks and file permissions. Each matrix job
also builds and starts its Docker image and checks the health endpoint.
The workflow builds artifacts; it does not publish images or deploy services.

## Last observed verification

These results record earlier implementation checks, not a fresh execution during
this documentation update. Docker and hosted CI remain unverified.

- All nine tests passed under the pinned Node.js 22.11.0 executable.
- Clean compilation and frozen-lockfile installation passed.
- Both production directories were generated and passed isolated HTTP smoke tests.
- Local Docker validation was unavailable because the Docker daemon did not
  return server information. Container builds and smoke tests are configured
  in CI but have not been observed running there yet.

The elevated package-manager launcher still selects Node.js 24.22.1 and warns
about the declared Node 22 engine. Runtime and direct test verification used
the pinned Node.js 22.11.0 executable.
