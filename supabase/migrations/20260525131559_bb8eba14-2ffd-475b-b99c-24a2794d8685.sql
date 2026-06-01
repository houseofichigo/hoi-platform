-- USE CASES: add v2.2 fields
ALTER TABLE public.use_cases
  ADD COLUMN IF NOT EXISTS use_case_family text,
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS post_commit_edits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capture_version text NOT NULL DEFAULT '2.2';

-- Make legacy `function` nullable to allow new captures without it
ALTER TABLE public.use_cases ALTER COLUMN function DROP NOT NULL;

-- Add check constraints (drop first if exist)
DO $$ BEGIN
  ALTER TABLE public.use_cases DROP CONSTRAINT IF EXISTS use_cases_use_case_family_check;
  ALTER TABLE public.use_cases ADD CONSTRAINT use_cases_use_case_family_check
    CHECK (use_case_family IS NULL OR use_case_family IN
      ('internal_ops','service_delivery','decision_support','compliance_control','data_enablement'));
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.use_cases DROP CONSTRAINT IF EXISTS use_cases_lifecycle_state_check;
  ALTER TABLE public.use_cases ADD CONSTRAINT use_cases_lifecycle_state_check
    CHECK (lifecycle_state IN ('draft','submitted','reviewed','committed'));
EXCEPTION WHEN others THEN NULL; END $$;

-- USE CASE SCORES: widen for v2.2
ALTER TABLE public.use_case_scores
  ADD COLUMN IF NOT EXISTS business_impact numeric,
  ADD COLUMN IF NOT EXISTS feasibility numeric,
  ADD COLUMN IF NOT EXISTS process_maturity numeric,
  ADD COLUMN IF NOT EXISTS risk numeric,
  ADD COLUMN IF NOT EXISTS ai_suitability numeric,
  ADD COLUMN IF NOT EXISTS agent_suitability numeric,
  ADD COLUMN IF NOT EXISTS complexity_score numeric,
  ADD COLUMN IF NOT EXISTS complexity_tag text,
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS scoring_version text NOT NULL DEFAULT '2.2';

-- Drop legacy tier column + constraint
ALTER TABLE public.use_case_scores DROP CONSTRAINT IF EXISTS use_case_scores_tier_check;
ALTER TABLE public.use_case_scores DROP COLUMN IF EXISTS tier;

-- Replace quadrant check with v2.2 values
ALTER TABLE public.use_case_scores DROP CONSTRAINT IF EXISTS use_case_scores_quadrant_check;
ALTER TABLE public.use_case_scores
  ADD CONSTRAINT use_case_scores_quadrant_check
  CHECK (quadrant IS NULL OR quadrant IN
    ('quick-wins','strategic-projects','tactical-improvements','foundational-rebuilds'));

-- Classification check
ALTER TABLE public.use_case_scores DROP CONSTRAINT IF EXISTS use_case_scores_classification_check;
ALTER TABLE public.use_case_scores
  ADD CONSTRAINT use_case_scores_classification_check
  CHECK (classification IS NULL OR classification IN
    ('Automation','AI Assistant','AI Workflow','AI Agent','Not Ready'));

-- Backfill: map old quadrant values to v2.2 equivalents
UPDATE public.use_case_scores SET quadrant = CASE quadrant
  WHEN 'start_now' THEN 'quick-wins'
  WHEN 'plan'      THEN 'strategic-projects'
  WHEN 'reshape'   THEN 'tactical-improvements'
  WHEN 'park'      THEN 'foundational-rebuilds'
  ELSE quadrant
END WHERE quadrant IN ('start_now','plan','reshape','park');

-- Backfill use_case_family from legacy function values (best-effort)
UPDATE public.use_cases SET use_case_family = 'internal_ops'
WHERE use_case_family IS NULL;