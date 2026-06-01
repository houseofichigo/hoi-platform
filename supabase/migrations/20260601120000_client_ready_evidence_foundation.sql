-- Client-ready evidence foundation.
-- Adds auditable score snapshots, governance lifecycle metadata, roadmap source
-- metadata, onboarding events, and support follow-up fields.

CREATE TABLE IF NOT EXISTS public.assessment_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_type text NOT NULL DEFAULT 'assessment_maturity',
  scoring_model_version text NOT NULL,
  input_hash text NOT NULL,
  raw_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_codes text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS assessment_score_snapshots_workspace_idx
ON public.assessment_score_snapshots (workspace_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS assessment_score_snapshots_user_idx
ON public.assessment_score_snapshots (workspace_id, user_id, computed_at DESC);

ALTER TABLE public.assessment_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view assessment score snapshots"
ON public.assessment_score_snapshots FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(workspace_id, auth.uid())
);

CREATE POLICY "Members can insert their assessment score snapshots"
ON public.assessment_score_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND computed_by = auth.uid()
  AND public.is_workspace_member(workspace_id, auth.uid())
);

CREATE TABLE IF NOT EXISTS public.use_case_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  use_case_id uuid NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  score_type text NOT NULL DEFAULT 'use_case_priority',
  scoring_model_version text NOT NULL,
  input_hash text NOT NULL,
  raw_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_codes text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS use_case_score_snapshots_workspace_idx
ON public.use_case_score_snapshots (workspace_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS use_case_score_snapshots_use_case_idx
ON public.use_case_score_snapshots (use_case_id, computed_at DESC);

ALTER TABLE public.use_case_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view use case score snapshots"
ON public.use_case_score_snapshots FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(workspace_id, auth.uid())
);

CREATE POLICY "Use case modifiers can insert score snapshots"
ON public.use_case_score_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  public.can_modify_use_case(use_case_id, auth.uid())
);

ALTER TABLE public.governance_flags
  ADD COLUMN IF NOT EXISTS reviewer_role text,
  ADD COLUMN IF NOT EXISTS evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved_reason text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS recomputed_at timestamptz;

ALTER TABLE public.roadmap_entries
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gate_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_events_workspace_idx
ON public.onboarding_events (workspace_id, created_at DESC);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins can view onboarding events"
ON public.onboarding_events FOR SELECT
TO authenticated
USING (
  workspace_id IS NOT NULL
  AND public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
);

CREATE POLICY "Members can insert onboarding events"
ON public.onboarding_events FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    workspace_id IS NULL
    OR public.is_workspace_member(workspace_id, auth.uid())
  )
);

ALTER TABLE public.hoi_admin_notes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewed','closed')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hoi_admin_notes_entity_idx
ON public.hoi_admin_notes (entity_type, entity_id, created_at DESC);
