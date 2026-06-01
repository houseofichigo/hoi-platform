
-- =====================================================================
-- SCALE PHASE TABLES
-- =====================================================================

-- Roadmap entries
CREATE TABLE public.roadmap_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  use_case_id uuid NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'backlog' CHECK (stage IN ('backlog','pilot','production','scaling','retired')),
  target_quarter text,
  priority_score numeric,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (use_case_id)
);
CREATE INDEX idx_roadmap_entries_ws_stage ON public.roadmap_entries(workspace_id, stage);

CREATE TRIGGER trg_roadmap_entries_updated_at
  BEFORE UPDATE ON public.roadmap_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.roadmap_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view roadmap entries"
  ON public.roadmap_entries FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert roadmap entries"
  ON public.roadmap_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "Admins update roadmap entries"
  ON public.roadmap_entries FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "Admins delete roadmap entries"
  ON public.roadmap_entries FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));


-- Roadmap stage history
CREATE TABLE public.roadmap_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  roadmap_entry_id uuid NOT NULL REFERENCES public.roadmap_entries(id) ON DELETE CASCADE,
  use_case_id uuid NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  from_stage text CHECK (from_stage IS NULL OR from_stage IN ('backlog','pilot','production','scaling','retired')),
  to_stage text NOT NULL CHECK (to_stage IN ('backlog','pilot','production','scaling','retired')),
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_roadmap_stage_history_entry ON public.roadmap_stage_history(roadmap_entry_id);
CREATE INDEX idx_roadmap_stage_history_ws ON public.roadmap_stage_history(workspace_id);

ALTER TABLE public.roadmap_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view stage history"
  ON public.roadmap_stage_history FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert stage history"
  ON public.roadmap_stage_history FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));


-- Governance flags
CREATE TABLE public.governance_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  use_case_id uuid NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  roadmap_entry_id uuid REFERENCES public.roadmap_entries(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  rule_source text NOT NULL CHECK (rule_source IN ('eu_ai_act','gdpr','internal_policy')),
  severity text NOT NULL CHECK (severity IN ('hard_stop','requires_action','advisory')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','accepted_risk','not_applicable')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (use_case_id, rule_code)
);
CREATE INDEX idx_governance_flags_ws_status ON public.governance_flags(workspace_id, status, severity, rule_source);

CREATE TRIGGER trg_governance_flags_updated_at
  BEFORE UPDATE ON public.governance_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.governance_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view governance flags"
  ON public.governance_flags FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins insert governance flags"
  ON public.governance_flags FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "Admins or assignee update governance flags"
  ON public.governance_flags FOR UPDATE TO authenticated
  USING (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
    OR assignee_id = auth.uid()
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
    OR assignee_id = auth.uid()
  );

CREATE POLICY "Admins delete governance flags"
  ON public.governance_flags FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));


-- Audit log (append-only)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_ws_created ON public.audit_log(workspace_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER server flows write.


-- Post-pilot reviews
CREATE TABLE public.post_pilot_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  use_case_id uuid NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  roadmap_entry_id uuid REFERENCES public.roadmap_entries(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accuracy_score numeric,
  time_saved_hours_per_week numeric,
  error_rate_percent numeric,
  reviewer_load text CHECK (reviewer_load IS NULL OR reviewer_load IN ('reduced','unchanged','increased')),
  user_satisfaction text CHECK (user_satisfaction IS NULL OR user_satisfaction IN ('positive','neutral','negative')),
  recommendation text CHECK (recommendation IS NULL OR recommendation IN ('promote_to_production','extend_pilot','redesign','retire')),
  evidence_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_pilot_reviews_ws_uc ON public.post_pilot_reviews(workspace_id, use_case_id);

ALTER TABLE public.post_pilot_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view post pilot reviews"
  ON public.post_pilot_reviews FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members submit post pilot reviews"
  ON public.post_pilot_reviews FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid())
    AND public.can_access_use_case(use_case_id, auth.uid())
    AND submitted_by = auth.uid()
  );

CREATE POLICY "Submitter or admin updates post pilot reviews"
  ON public.post_pilot_reviews FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  );

CREATE POLICY "Admins delete post pilot reviews"
  ON public.post_pilot_reviews FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));


-- =====================================================================
-- BUILD APPROVAL -> SCALE ROADMAP INTEGRATION
-- =====================================================================
-- When a use case transitions to status 'approved', upsert a roadmap_entries
-- row in 'backlog', record stage history, and write an audit_log entry.
-- Idempotent via UNIQUE(use_case_id) on roadmap_entries.

CREATE OR REPLACE FUNCTION public.add_use_case_to_roadmap_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry public.roadmap_entries;
  v_priority numeric;
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT priority INTO v_priority
  FROM public.use_case_scores
  WHERE use_case_id = NEW.id
  ORDER BY updated_at DESC
  LIMIT 1;

  INSERT INTO public.roadmap_entries (
    workspace_id, use_case_id, owner_id, stage, priority_score, created_by
  )
  VALUES (
    NEW.workspace_id, NEW.id, NEW.created_by, 'backlog', v_priority, v_actor
  )
  ON CONFLICT (use_case_id) DO NOTHING
  RETURNING * INTO v_entry;

  -- If conflict, no new entry — exit (idempotent)
  IF v_entry.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.roadmap_stage_history (
    workspace_id, roadmap_entry_id, use_case_id, from_stage, to_stage, reason, changed_by
  ) VALUES (
    NEW.workspace_id, v_entry.id, NEW.id, NULL, 'backlog',
    'Approved in Build and added to Scale roadmap', v_actor
  );

  INSERT INTO public.audit_log (
    workspace_id, actor_id, action_type, entity_type, entity_id, entity_label, after_state, metadata
  ) VALUES (
    NEW.workspace_id, v_actor, 'roadmap_added', 'roadmap_entry', v_entry.id, NEW.name,
    to_jsonb(v_entry),
    jsonb_build_object('use_case_id', NEW.id, 'source', 'build_approval')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_use_case_approval_roadmap
  AFTER INSERT OR UPDATE OF status ON public.use_cases
  FOR EACH ROW EXECUTE FUNCTION public.add_use_case_to_roadmap_on_approval();
