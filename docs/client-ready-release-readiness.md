# Client-Ready Release Readiness

## Validation Baseline

- [ ] Install dependencies with the locked package manager.
- [ ] Run route generation/type validation.
- [ ] Run `bun run check:imports`.
- [ ] Run `bun run check:assess-outputs`.
- [ ] Run `bun run check:build-outputs`.
- [ ] Run `bun run test`.
- [ ] Run `bun run build`.
- [ ] Apply Supabase migrations in a staging project.

## Client Evidence

- [ ] Assessment completion creates an official assessment score snapshot.
- [ ] Build scoring creates a use-case score snapshot.
- [ ] Governance flags include reviewer role and evidence requirements.
- [ ] Deploy evidence pack exports assessment, use-case portfolio, priority matrix, governance register, roadmap, audit log, and evidence checklist.

## Smoke Test

- [ ] Create a new user without invite.
- [ ] Create a workspace and set it as default.
- [ ] Complete onboarding checklist.
- [ ] Complete Assess and compute official score.
- [ ] Add one Discover asset to roadmap.
- [ ] Capture a Build use case and submit for approval.
- [ ] Approve, return, and reject approval paths in staging.
- [ ] Recompute governance flags.
- [ ] Move roadmap items through allowed stages.
- [ ] Generate an evidence pack.

## Release Gate

- [ ] No blocker or high-severity product issue remains open.
- [ ] Demo data is clearly marked and not mixed into client tenant data.
- [ ] Rollback and backup steps are owned by the deployment team.
