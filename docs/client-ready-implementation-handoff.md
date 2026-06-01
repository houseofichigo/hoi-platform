# Client-Ready Implementation Handoff

This handoff records the implementation work completed in this app copy and the remaining server/deployment work for the dev team.

## Implemented In This Batch

- Replaced the active governance flag taxonomy with Saudi-market sources:
  - SDAIA
  - PDPL
  - NDMO
  - NCA / SAMA
  - SAIP
  - Internal policy
- Updated governance rule codes and client explanations for:
  - high-impact AI
  - human oversight
  - transparency
  - technical documentation
  - model validation
  - privacy impact review
  - data minimisation
  - cross-border transfer review
  - data governance review
  - security review
  - IP review
  - change management
- Added deduplication to the flag engine so one rule code cannot be emitted twice from overlapping triggers.
- Added structured Build capture fields required by the governance engine:
  - customer-facing output
  - automated impact on individuals
  - offshore/external vendor access
  - training/reference data origin
  - vendor model or asset reuse
- Added backend/server-function stage gates for roadmap movement:
  - Pilot requires owner and score.
  - Not Ready use cases cannot enter pilot.
  - Production requires owner, score, delivery readiness, and the existing pilot review rule.
  - Scaling requires owner and resolved or accepted blocker/action flags.
- Added audit logging for blocked stage-gate transitions.
- Updated the Governance Center to read as a Saudi-market control room instead of an EU/GDPR register.
- Added a Scale evidence pack export in JSON:
  - workspace summary
  - roadmap entries
  - latest scores attached to roadmap entries
  - governance flag register
  - recent stage history
  - evidence checklist
- Added a Supabase migration to allow KSA rule sources while preserving old EU/GDPR rows for historical compatibility.
- Updated Discover/library framework options from EU/GDPR-first to KSA-first.
- Updated core curriculum and selected worked-example language from EU/GDPR framing to Saudi-market framing.

## Dev Team Deployment Tasks

- Run Supabase migrations in staging and confirm the governance flag source constraint is updated.
- Regenerate Supabase TypeScript types after migrations.
- Install dependencies and run:
  - `npm test -- src/lib/scale/governanceFlags.test.ts`
  - `npm run build`
- Seed or migrate existing historical flags if the client should not see legacy EU/GDPR source values.
- Decide whether evidence packs should remain client-side JSON for v1 or be promoted to a backend-generated PDF/ZIP pack.
- Confirm production monitoring for failed server functions and blocked transition audit events.

## Known Boundaries

- This app copy is Supabase/React/TanStack based. It does not contain the Django/Celery backend from the earlier architectural plan.
- The official scoring engine in this copy already runs through server functions, but a fully versioned backend score-snapshot table is still a later backend hardening task if the dev team moves scoring into a separate backend service.
- The JSON evidence pack is deploy-ready as a practical export, but not a designed board-pack PDF.
