# Restore the real Capture Wizard

## What happened

Two turns ago I shipped the full **4-step intake** with `src/lib/build/wizard-schema.ts` — keys aligned to `src/lib/scoring.functions.ts` (e.g. `business_objectives`, `use_case_shape`, `primary_systems`, `accessibility`, `classification`, `output_criticality`, etc.).

Last turn the preview crashed with an SSR error because that `wizard-schema.ts` file was no longer on disk (the route still imported it). I recreated it in a hurry to unblock the build, but I wrote a **generic 5-step placeholder** (Context / Value / Data / Governance / Plan) with arbitrary field keys. The route compiles and renders, but:

- The wizard is now 5 steps instead of 4, with the wrong titles and progress (20/40/60/80/100 instead of 10/32/52/84/100).
- The field keys no longer match the scoring engine, so anything captured won't actually drive priority, classification, or readiness.
- All the spec'd field types (radio-cards with "advanced" badges, accordion checkbox groups, repeaters for inputs/outputs/steps, capped checkbox grids 1–3) are gone.

The route file itself (`src/routes/app.$workspaceSlug.build.capture.$useCaseId.tsx`) is unchanged — only the schema module is wrong.

## Fix

Rewrite **only** `src/lib/build/wizard-schema.ts` to restore the 4-step spec.

### Step structure
1. **Strategic Intent** — progress 10% — Process Name (text 2–60), Use Case Family (radio-cards), What kind of use case (radio 2-col), Target Business Domain (radio 2-col), Business Objectives (checkbox-grid 2-col, 1–3), Problems today (chips), Key decision points (chips), System should (chips), System should not (chips), Success Metric (text, required), In Scope (textarea, required), Out of Scope (textarea, required).
2. **Data & System** — progress 32% — Primary Data Sources (checkbox-grid 2-col, max 5), Other Source (text), Data Readiness (radio-cards), Data Accessibility (radio-cards), Data Classification with amber "GDPR restricted/special-category" advanced flags (radio-cards), Data Structure Type (radio-cards), System Actionability (radio-cards), Historical Cases (radio).
3. **Process Shape** — progress 52% — Number of Steps (radio), Decision Points (radio), Decision Logic Type (radio-cards), Rules Documentation (radio-cards), Process Standardization (radio-cards), Exception Rate (radio), Frequency (chips), Volume Estimate (text), Trigger Type (radio-cards), Trigger Detectability (radio), Process Inputs (repeater, max 5), Process Outputs (repeater, max 5), Process Steps (repeater, optional).
4. **Governance** — progress 84% (final saves at 100%) — Maximum Acceptable Autonomy (radio-cards, with amber "Semi-agentic / Agentic" advanced badge), Non-Negotiable Constraints (accordion-checkboxes grouped: Compliance, Data, Operational, Financial; plus "not yet identified" none-option), Impact If Failure (radio), Risk Tolerance (radio), Error Reversibility (radio-cards), Output Criticality (radio-cards), Process Owner (text, required), Monitoring Plan (textarea), Rollback Path (textarea).

### Field keys → scoring engine
Keys will mirror what `src/lib/scoring.functions.ts` already reads:
`process_name`, `use_case_family`, `use_case_kind`, `business_domain`, `business_objectives`, `problems_today`, `decision_points`, `system_should`, `system_should_not`, `success_metric`, `in_scope`, `out_of_scope`, `primary_systems`, `other_system`, `data_readiness`, `accessibility`, `classification`, `data_structure`, `system_actionability`, `historical_cases`, `num_steps`, `decision_logic_type`, `rules_documentation`, `standardisation`, `exception_rate`, `frequency`, `volume`, `trigger_type`, `trigger_detectability`, `process_inputs`, `process_outputs`, `workflow_steps`, `max_autonomy`, `non_negotiable_constraints`, `impact_if_failure`, `risk_tolerance`, `error_reversibility`, `output_criticality`, `process_owner`, `monitoring_plan`, `rollback_path`.

### Types & exports kept stable
Same exported surface the route already imports: `STEPS`, `validateStep`, `FieldDef`, `StepDef`, `WizardValues`, plus `FieldKind`, `FieldOption`, `FieldGroup`, `RepeaterColumn`, `isFieldFilled` — so the route, the inline renderers (`RadioCards`, `CheckboxGrid`, `ChipGroup`, `AccordionCheckboxes`, `Repeater`), and the persisted `responses` JSONB in `use_case_captures` all keep working with zero edits elsewhere.

## Out of scope (intentionally)

- No changes to the route file, hooks (`useBuild`), DB schema, scoring engine, dashboard, library, approvals, or governance flags.
- No new migration — `use_case_captures.responses` is JSONB and already accepts any shape.
- Existing in-progress captures with the placeholder keys (`problem_statement`, `value_type`, etc.) won't carry over — those values will simply be ignored, and steps will appear empty until refilled. If you have a real draft mid-flight you don't want to lose, tell me before I run this and I'll add a one-time migration of those keys into the closest new keys.

## Verification

After the rewrite I'll:
1. Confirm the route compiles (TS no longer reports missing keys).
2. Reload `/app/house-of-ichigo/build/capture/<id>` and confirm 4 steps with the right titles, progress percentages, Quick Guide callouts, and advanced badges render.
3. Spot-check that `validateStep` blocks Continue on a missing required field and that Save draft persists to `use_case_captures`.
