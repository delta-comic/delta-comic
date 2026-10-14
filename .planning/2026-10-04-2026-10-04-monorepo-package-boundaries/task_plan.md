# Monorepo package boundary audit

**Goal:** Ensure every workspace package has a real build/package entry and every cross-package `@delta-comic/*` dependency uses exactly `"workspace:"`; remove cross-package relative/absolute path references while preserving package-internal relative imports.

## Phases

1. **Inventory** — inspect workspace packages, scripts, dependency declarations, TypeScript/Vite/Rust/config references. (in_progress)
2. **Design minimum fixes** — classify findings into package metadata, build graph, and cross-package source/config paths. (pending)
3. **Implement** — edit only required manifests/config/source files; update lockfile through Vite+ tooling if needed. (pending)
4. **Validate** — build all packages, run checks/typecheck/tests relevant to changed paths, verify no forbidden references remain. (pending)
5. **Commit** — inspect diff and create signed Conventional Chinese commit, preserving unrelated user changes. (pending)

## Constraints

- Workspace glob remains `packages/*/*/*`.
- Cross-package package dependencies must be exactly `"@delta-comic/<name>": "workspace:"`.
- Relative imports inside one package remain valid.
- Do not hand-edit generated declaration files.
- Use `vp`, not pnpm/vite/vitest directly.
- Existing user modifications were present before this task and must be preserved.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Planning helper treated `--help` as a plan id | 1 | Removed accidental plan directory and initialized the task-specific plan |

## Next Step

Complete the inventory and record concrete findings with file/line evidence.
