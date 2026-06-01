# Current protected plan

This app already contains the protected Assess, Discover, Build, and Scale source tree. Do not rebuild these phases from scratch, delete their support folders, or replace real product flows with placeholders.

## Source-tree contract

Treat `docs/source-tree-contract.md` as authoritative.

Protected paths:

- `src/routes/app.$workspaceSlug.build*`
- `src/routes/app.$workspaceSlug.scale*`
- `src/components/build/`
- `src/lib/build/`
- `src/lib/scale/`
- `scripts/check-import-integrity.ts`
- `scripts/check-build-output-keys.ts`

The global phase order is intentionally:

1. Assess
2. Discover
3. Build
4. Scale

Do not reorder phases.

## Build phase status

The Build capture wizard is the real four-step wizard, not a placeholder:

1. Strategic Intent
2. Data & System
3. Process Shape
4. Governance

The route imports `@/lib/build/wizard-schema`. Preserve these stable exports:

- `STEPS`
- `validateStep`
- `isFieldFilled`
- `FieldDef`
- `StepDef`
- `WizardValues`

The wizard field keys are aligned to `src/lib/scoring.functions.ts` and must stay aligned. The final submission must score the use case before approval submission.

## Current hardening work

The next safe improvements are:

1. Keep Build approvals behind `src/lib/build/approvals.functions.ts`.
2. On approval, generate Scale governance flags through `src/lib/scale/scale.functions.ts`.
3. Keep repeater validation strict enough that a process/input/output row only counts when its columns are complete.
4. Preserve the existing tabs, phase order, content, and source-tree checks.

## Required verification

When the toolchain is available, run:

- `bun scripts/check-import-integrity.ts`
- `bun scripts/check-build-output-keys.ts`
- `bun scripts/check-assess-output-keys.ts`
- `bunx tsc --noEmit`
- `bun run build`
- `bunx vitest run`

Do not delete checks or routes to make validation pass. Fix the root cause.
