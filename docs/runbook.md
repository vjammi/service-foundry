# Service Foundry runbook

Reviewed November 16, 2026 against the checked-in scripts and configuration.
Run commands from the repository root unless a step explicitly changes directory.
For package ownership, public exports, and the compiler graph, see
[Architecture and deployment](architecture-and-deployment.md).

## Prerequisites and installation

| Component | Version or requirement |
| --- | --- |
| Node.js | 22.11.0, pinned in `.nvmrc` and `.node-version` |
| Supported runtime | `>=22.11.0 <23` in root `engines.node` |
| pnpm | 9.14.2, pinned in `packageManager` and `engines.pnpm` |
| TypeScript | 5.9.3, installed as a root development dependency |
| Docker | Required only for image builds and container execution; daemon must be running |

Activate the pinned Node version using your installed version manager, then:

```sh
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm check
```

Expect Node `v22.11.0` and pnpm `9.14.2`. If Corepack is unavailable, install the
pinned pnpm explicitly with `npm install --global pnpm@9.14.2`.
Install development dependencies on the build machine; production-only installs
do not provide the TypeScript compiler.

The last verified folder is `C:\ds\workspace\node\monorepo-sample`. Service
Foundry is already the project name and package scope. A physical folder rename
to `service-foundry` was attempted but blocked by a process holding it open.
Commands below do not depend on the checkout folder name.

## Start and stop applications

```sh
pnpm start
```

This builds the graph and starts both applications in parallel. To run them
independently, build once, then use separate terminals:

```sh
pnpm build
pnpm --filter @service-foundry/console start
```

```sh
pnpm --filter @service-foundry/server start
```

Filtered start commands run existing `dist/main.js`; they do not build first.
Press Ctrl+C to stop a foreground process. Each application's startup code
handles SIGINT/SIGTERM, closes its HTTP server, and sets a ten-second shutdown
deadline. Process termination behavior also depends on the shell and platform.

## Configure host and port

| Setting | Console default | API default |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | `0.0.0.0` |
| `PORT` | `3000` | `3001` |

Ports must be integers from 0 to 65535. Port 0 selects an available port; startup
logs report the actual port. Both applications read process environment
variables directly; no `.env` loader is configured.

PowerShell example for running only the API on a different loopback port:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '4001'
pnpm --filter @service-foundry/server start
```

After stopping it, remove these overrides if they are no longer needed:

```powershell
Remove-Item Env:HOST -ErrorAction SilentlyContinue
Remove-Item Env:PORT -ErrorAction SilentlyContinue
```

On POSIX shells:

```sh
HOST=127.0.0.1 PORT=4001 pnpm --filter @service-foundry/server start
```

A `PORT` override on root `pnpm start` is inherited by both applications and can
cause an address conflict. Use defaults for a combined start or launch each
application separately with its own environment.

## Verify HTTP behavior

| URL with default configuration | Expected response |
| --- | --- |
| `http://localhost:3000/` | HTML containing `Hello, User!` |
| `http://localhost:3001/api/hello` | `{"message":"Hello, API User!"}` |
| `http://localhost:3000/health` | `{"status":"ok"}` |
| `http://localhost:3001/health` | `{"status":"ok"}` |

All listed routes return HTTP 200. Unknown routes return 404. Health checks
report process availability only; they do not check databases or other services.

PowerShell checks:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/api/hello
```

## Develop, compile, and test

| Command | Behavior |
| --- | --- |
| `pnpm build` | Incremental compilation of all referenced projects |
| `pnpm clean` | Remove TypeScript outputs and incremental metadata |
| `pnpm watch` | Recompile when source changes |
| `pnpm test` | Build incrementally and run all package tests |
| `pnpm check` | Clean, build, and run all nine tests |
| `pnpm --filter @service-foundry/server build` | Build the API and its referenced shared library |
| `pnpm --filter @service-foundry/server test` | Test the already-compiled API |

For development, start `pnpm watch` in one terminal, wait for initial compilation,
and start applications in other terminals. Restart each application to load new
output; watch mode does not restart servers. Avoid running `pnpm clean` while
applications or watch compilation are active.

Tests use Node's built-in runner against compiled output, with ephemeral loopback
ports. Coverage includes application responses, health, 404s, greetings, blocked
internal imports, and ESM loading of the shared public API. Linting and formatting
tools and checks are not configured; `pnpm check` does not perform those tasks.

## Create production bundles

Use empty output targets for a fresh release:

```sh
pnpm deploy:console
pnpm deploy:server
node scripts/smoke-deployment.cjs artifacts/console console
node scripts/smoke-deployment.cjs artifacts/server server
```

Each command builds its selected application and uses pinned pnpm 9.14.2
`deploy --prod` to include its compiled output and isolated runtime dependencies,
including `@service-foundry/shared`. Copy the whole bundle, including
`node_modules`; copying only `dist` omits dependencies. Build on the deployment
OS and architecture if native dependencies are introduced.

The smoke script starts the selected bundle on an ephemeral loopback port,
checks health and its public response, and stops the process. Earlier artifacts
may still use old package names; regenerate them from current source for release.
Retain a previous known-good bundle or image separately when preparing an update.

To run a bundle directly, choose one directory:

```sh
cd artifacts/server
node dist/main.js
```

Use the same command from `artifacts/console` for the console. Set `NODE_ENV`,
`HOST`, and `PORT` in your deployment environment. Service supervision, secrets,
TLS termination, production rollout, and rollback automation are not configured
in this repository.

## Build and run containers

From the repository root, with Docker running:

```sh
docker build -f packages/apps/console/Dockerfile -t service-foundry-console .
docker build -f packages/services/server/Dockerfile -t service-foundry-server .
docker run --rm --name service-foundry-console -p 3000:3000 service-foundry-console
```

In a second terminal:

```sh
docker run --rm --name service-foundry-server -p 3001:3001 service-foundry-server
```

Stop them with `docker stop service-foundry-console service-foundry-server`.
Each image builds an isolated production bundle, runs as the `node` user, and
includes an HTTP health check. To change a container port, change both its
environment and mapping, for example `-e PORT=4001 -p 4001:4001` for the API.

## CI and release checks

`.github/workflows/ci.yml` runs on pushes and pull requests. The check job installs
the pinned toolchain, performs a frozen install, and runs `pnpm check`. Dependent
matrix jobs package each application, smoke test the production bundle, upload
a tar archive, and build and smoke test its Docker image. Archives preserve
dependency symlinks and file permissions.

Review all jobs before using the produced archives. The workflow does not
publish container images or deploy to an environment. GitHub-hosted CI has not
yet been observed running during this work; Docker validation was blocked by
the unavailable local daemon. Earlier clean builds, nine tests, frozen installs,
and both renamed production-bundle smoke tests passed. This documentation
update does not represent a new execution of those checks.

## Troubleshooting

| Symptom | Check or recovery |
| --- | --- |
| Node engine warning | Check the executable selected by the shell or IDE; the elevated launcher previously used Node 24.22.1 instead of pinned Node 22.11.0 |
| pnpm missing | Enable Corepack or install pnpm 9.14.2 explicitly |
| Frozen install rejects the lockfile | Confirm the intended manifests; after intentional dependency edits, run `pnpm install`, review, and retain the updated lockfile |
| Shared package or `dist/main.js` not found | Run `pnpm install --frozen-lockfile` and `pnpm build` from the root |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Import `@service-foundry/shared`, not a source or `dist` subpath |
| `EADDRINUSE` | Stop the process occupying the port or select another per-application `PORT` |
| Changes do not appear | Wait for compilation, then restart the running application |
| Deployment target already populated | Preserve or clear the old generated bundle before creating the new one |
| Docker cannot connect | Start the Docker daemon and confirm `docker info` succeeds |

## Add a workspace package

Place a package under `packages/apps/*` or `packages/services/*`, declare its
`@service-foundry/*` name, and keep runtime dependencies in its own manifest.
Extend `../../../tsconfig.base.json`; configure `src`, `dist`, and
`dist/.tsbuildinfo`. Add the project to root references. For consumed libraries,
declare both `workspace:*` dependencies and TypeScript references, and import
only public exports. Applications need explicit startup, test, deployment, and
CI entries as appropriate; workspace discovery alone does not add those entries.
