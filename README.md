# Service Foundry

A pnpm TypeScript workspace for Node.js applications and shared services.

## Project structure

```text
packages/
  apps/
    console/          @service-foundry/console: Express HTML application
  services/
    server/           @service-foundry/server: Express JSON API
    shared/           @service-foundry/shared: shared library
docs/                 Architecture, runbook, and historical analysis
scripts/              Deployment smoke test
.github/workflows/    Build, test, and deployment-artifact CI
```

Workspace discovery covers `packages/apps/*` and `packages/services/*`.
Both applications depend on the shared library through `workspace:*` and
TypeScript project references. The console does not call the API.

## Quick start

Run these commands from the repository root with Node.js 22.11.0 active:

```sh
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm check
pnpm start
```

The expected pnpm version is 9.14.2. TypeScript is pinned to 5.9.3.
`pnpm start` builds first and starts both applications in parallel.

| Application | URL | Health |
| --- | --- | --- |
| Console | http://localhost:3000/ | http://localhost:3000/health |
| API | http://localhost:3001/api/hello | http://localhost:3001/health |

## Build and package

Each package compiles `src/` into its own `dist/` with strict checking,
CommonJS JavaScript, declarations, and source maps. Root `tsc -b` builds shared
code before its consumers and keeps incremental metadata package-local.
Applications start with `node dist/main.js`.

| Command | Purpose |
| --- | --- |
| `pnpm build` | Incremental compilation of the full graph |
| `pnpm check` | Clean build and all nine tests |
| `pnpm watch` | Recompile on changes; restart applications separately |
| `pnpm deploy:console` | Build and package the console into `artifacts/console` |
| `pnpm deploy:server` | Build and package the API into `artifacts/server` |

Use empty deployment targets. Both bundles include production dependencies and
the compiled shared library. Per-application Dockerfiles and GitHub Actions CI
are configured. Linting and formatting checks are not yet configured.

## Documentation

- [Architecture and deployment](docs/architecture-and-deployment.md): package boundaries, compiler model, exports, CI, and gap checklist.
- [Runbook](docs/runbook.md): setup, development, configuration, verification, deployments, and troubleshooting.
- [TypeScript build migration](docs/typescript-build-migration.md): historical record of the first implementation stage.
- [Initial monorepo analysis](docs/initial-monorepo-analysis.md): original JavaScript workspace and architecture proposal.

The project and package scope are named Service Foundry and `@service-foundry/*`.
The last verified local directory is still `C:\ds\workspace\node\monorepo-sample`;
the attempted physical rename was blocked by an open process. Commands are
relative to the repository root and remain valid after a folder rename.
