# Source Tree Contract

These paths are load-bearing for the HOI app. Do not delete or rename them
without an explicit user request that names the path. Any prompt that touches
Admin, Discover, Assess, or styling MUST still run the import integrity check
below before reporting success.

## Protected folders / files

- `src/routes/app.$workspaceSlug.build*` — all Build routes
- `src/routes/app.$workspaceSlug.scale*` — all Scale routes
- `src/components/build/` — Build UI support layer
- `src/lib/build/` — Build server functions, scoring, normalization
- `src/lib/scale/` — Scale governance, queries, server functions
- `scripts/check-import-integrity.ts` — source-tree integrity guard
- `scripts/check-build-output-keys.ts` — Build output-key consistency check

## Rules

1. Never delete a route file to make a check pass. Fix the missing dependency
   instead.
2. Never delete a script in `scripts/check-*` to silence a failure.
3. Phase order in `src/components/TopShell.tsx` must remain
   Assess → Discover → Build → Scale.
4. Before reporting success on any change — including Admin, Discover, Assess,
   or pure styling work — run:

   ```sh
   bun scripts/check-import-integrity.ts
   bunx tsc --noEmit
   ```

   Both must pass. Import integrity failures indicate a missing support file
   and must be fixed by restoring the dependency, not by editing the importer
   to hide the gap.
