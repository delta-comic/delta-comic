# Delta Comic Agent Guide

## Toolchain

- Use Vite+ (`vp`), not direct `pnpm`, `vite`, `vitest`, `oxlint`, or `oxfmt` commands. The
  repository pins Node `25.9.0`, pnpm `11.18.0`, and Rust `1.94.0` (edition 2024).
- Run `vp install` after pulling dependency changes. CI uses `vp install --frozen-lockfile`.
- Vite+ is not Vite: workspace scripts run with `vp run`, for example
  `vp run --filter app dev:web`. Local Vite+ docs are in `node_modules/vite-plus/docs`.
- Use the global `vp` in local sessions; use `pnpm exec vp` only where the global CLI is absent.

## Verification

- Build app dependencies before web checks/tests: `vp run lib-build`. Several packages export
  built `dist` files, so a clean checkout can otherwise fail resolution.
- Full web verification: `vp run lib-build`, `vp check`, `vp run -r typecheck`, then
  `vp test run`. `vp check` does not replace the explicit workspace typecheck because root lint
  type-checking is disabled.
- Run one test file with `vp test run packages/app/test/src/path/file.test.ts`; add
  `-t 'test name'` to focus one case. Test watch mode is `vp test watch <path>`.
- Coverage is `vp test run --coverage`; root thresholds are 75% lines/functions/statements and
  70% branches.
- Rust verification is separate: `cargo fmt --all --check`,
  `cargo clippy --workspace --all-targets --locked -- -D warnings`, and
  `cargo test --workspace --locked -- --test-threads=2`.
- Changes under `packages/downloader/android` also require the Gradle `ktlintCheck`, `lintDebug`,
  and `testDebugUnitTest` tasks. CI's exact JDK 21/Android 36 setup is in
  `.github/workflows/{lint,test}.yaml`.

## Runtime Entry Points

- `packages/app`: Vue/Tauri client. Web entry is `src/main.tsx`; native entry is
  `src-tauri/src/main.rs`. `vp run --filter app dev` starts Tauri; `dev:web` starts only the web
  client. Tauri requires port `5173` and fails rather than selecting another port.
- The app's `build:web`/`dev:web` first builds `@delta-comic/runtime`, the UMD host-library bridge
  used by external plugins. Preserve that dependency ordering.
- `packages/server/app/index.ts`: Elysia Cloudflare Worker entry. `packages/server/lib/index.ts` is
  the client/shared public API, not the Worker entry. Local startup requires
  `vp run --filter @delta-comic/server migrate:local` before `... dev`.
- `packages/server-admin` is a separate Vue admin app. Features are discovered from
  `src/features/*/feature.ts`; add a feature module instead of editing a central route list.
- `packages/{db,downloader,logger,model,plugin,ui,utils}` are publishable workspaces; some also map
  to Rust Tauri plugin crates through the root Cargo workspace. `packages/runtime`, `app`,
  `server`, and `server-admin` are private.

## Architecture Constraints

- Follow `packages/plugin/ARCHITECTURE.md` for plugin changes. Only `composition.ts` assembles
  concrete capabilities/adapters; `index.ts` is export-only; package code must not self-import
  `@delta-comic/plugin` or `@/index`.
- Built-in client plugins are file-driven `builtins/*.builtin.ts` default exports. Server built-ins
  are different: Wrangler does not transform `import.meta.glob`, so add an explicit ESM import to
  `packages/server/app/modules/plugins/definitions/index.ts`.
- Server deploy does not apply D1 migrations. Run the package's `migrate:remote` explicitly before
  `deploy`; use `migrate:local` for local D1.
- Do not hand-edit generated `components.d.ts`, `typed-router.d.ts`, or
  `packages/server/worker-configuration.d.ts`. Component/router declarations come from Vite
  plugins; Worker bindings come from `vp run --filter @delta-comic/server cf-typegen`.

## Repository Conventions

- UI styling uses Tailwind CSS. Plain CSS is limited to non-enumerable dynamic values, `@apply`,
  or the lightweight splash screen. Vue/component tags use PascalCase.
- Every new user-visible app string must use i18n and update `packages/app/src/i18n/locales/en-US.ts`,
  `zh-CN.ts`, and `zh-TW.ts`. Shared UI messages use the `ui.*` bridge configured in
  `packages/app/src/main.tsx`.
- Keep tests outside production directories and mirror the source path:
  `packages/x/lib/a.ts` -> `packages/x/test/lib/a.test.ts`; root scripts use `script/test`.
  Rust unit tests normally live under `packages/x/test/src` and are linked with `#[path = ...]`.
- Formatting is 2 spaces, no semicolons, single quotes, 100 columns; run `vp fmt`/`vp lint` rather
  than manually reformatting. Markdown and generated declarations are intentionally formatter
  exclusions.
- Commits use Conventional/Angular syntax with Chinese descriptions, for example
  `feat(ui): 实现列表组件`; commits must be signed. Pre-commit runs `vp staged`, which applies
  `vp check --fix` and cspell to staged files.
- Public package versions are released together and discovered from `packages/*/package.json`.
  Use `vp run set-ver -- <version>` rather than editing version-bearing manifests independently.
  Branch/release operations are documented in `docs/release-workflow.md` and must be dry-run first.
