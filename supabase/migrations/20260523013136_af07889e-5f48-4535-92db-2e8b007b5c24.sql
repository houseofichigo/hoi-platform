
-- use_cases
CREATE TABLE public.use_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  function text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT use_cases_function_check CHECK (function IN ('finance','sales','hr','customer_ops','procurement','marketing','legal','it','other')),
  CONSTRAINT use_cases_status_check CHECK (status IN ('draft','capturing','scored','submitted','approved','rejected','archived'))
);
CREATE INDEX idx_use_cases_workspace ON public.use_cases(workspace_id);
CREATE INDEX idx_use_cases_created_by ON public.use_cases(created_by);

ALTER TABLE public.use_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace use cases"
ON public.use_cases FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can create use cases in their workspace"
ON public.use_cases FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Creators or admins can update use cases"
ON public.use_cases FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']))
WITH CHECK (created_by = auth.uid() OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "Creators or admins can delete use cases"
ON public.use_cases FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']));

CREATE TRIGGER trg_use_cases_updated_at
BEFORE UPDATE ON public.use_cases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: check membership via use case
CREATE OR REPLACE FUNCTION public.can_access_use_case(_use_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.use_cases uc
    WHERE uc.id = _use_case_id
      AND public.is_workspace_member(uc.workspace_id, _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_modify_use_case(_use_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.use_cases uc
    WHERE uc.id = _use_case_id
      AND (uc.created_by = _user_id OR public.has_workspace_role(uc.workspace_id, _user_id, ARRAY['owner','admin']))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_use_case_admin(_use_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.use_cases uc
    WHERE uc.id = _use_case_id
      AND public.has_workspace_role(uc.workspace_id, _user_id, ARRAY['owner','admin'])
  )
$$;

-- use_case_captures
CREATE TABLE public.use_case_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case_id uuid NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  block_number integer NOT NULL,
  block_title text,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT use_case_captures_block_check CHECK (block_number IN (1,2,3,4)),
  CONSTRAINT use_case_captures_unique UNIQUE (use_case_id, block_number)
);
CREATE INDEX idx_use_case_captures_use_case ON public.use_case_captures(use_case_id);

ALTER TABLE public.use_case_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view captures for accessible use cases"
ON public.use_case_captures FOR SELECT TO authenticated
USING (public.can_access_use_case(use_case_id, auth.uid()));

CREATE POLICY "Modifiers insert captures"
ON public.use_case_captures FOR INSERT TO authenticated
WITH CHECK (public.can_modify_use_case(use_case_id, auth.uid()));

CREATE POLICY "Modifiers update captures"
ON public.use_case_captures FOR UPDATE TO authenticated
USING (public.can_modify_use_case(use_case_id, auth.uid()))
WITH CHECK (public.can_modify_use_case(use_case_id, auth.uid()));

CREATE POLICY "Modifiers delete captures"
ON public.use_case_captures FOR DELETE TO authenticated
USING (public.can_modify_use_case(use_case_id, auth.uid()));

CREATE TRIGGER trg_use_case_captures_updated_at
BEFORE UPDATE ON public.use_case_captures
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- use_case_scores
CREATE TABLE public.use_case_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case_id uuid NOT NULL UNIQUE REFERENCES public.use_cases(id) ON DELETE CASCADE,
  pillar_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_readiness numeric,
  priority numeric,
  quadrant text,
  tier text,
  reason_codes text[] NOT NULL DEFAULT '{}',
  gate_statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  step_automation_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  scored_at timestamptz,
  scored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT use_case_scores_quadrant_check CHECK (quadrant IS NULL OR quadrant IN ('start_now','plan','reshape','park')),
  CONSTRAINT use_case_scores_tier_check CHECK (tier IS NULL OR tier IN ('tier_1','tier_2','tier_3'))
);

ALTER TABLE public.use_case_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view scores for accessible use cases"
ON public.use_case_scores FOR SELECT TO authenticated
USING (public.can_access_use_case(use_case_id, auth.uid()));

CREATE POLICY "Modifiers insert scores"
ON public.use_case_scores FOR INSERT TO authenticated
WITH CHECK (public.can_modify_use_case(use_case_id, auth.uid()));

CREATE POLICY "Modifiers update scores"
ON public.use_case_scores FOR UPDATE TO authenticated
USING (public.can_modify_use_case(use_case_id, auth.uid()))
WITH CHECK (public.can_modify_use_case(use_case_id, auth.uid()));

CREATE POLICY "Modifiers delete scores"
ON public.use_case_scores FOR DELETE TO authenticated
USING (public.can_modify_use_case(use_case_id, auth.uid()));

CREATE TRIGGER trg_use_case_scores_updated_at
BEFORE UPDATE ON public.use_case_scores
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- use_case_approvals
CREATE TABLE public.use_case_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case_id uuid NOT NULL UNIQUE REFERENCES public.use_cases(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision text NOT NULL DEFAULT 'pending',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT use_case_approvals_decision_check CHECK (decision IN ('pending','approved','rejected','returned'))
);

ALTER TABLE public.use_case_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view approvals for accessible use cases"
ON public.use_case_approvals FOR SELECT TO authenticated
USING (public.can_access_use_case(use_case_id, auth.uid()));

CREATE POLICY "Modifiers insert approvals (submit)"
ON public.use_case_approvals FOR INSERT TO authenticated
WITH CHECK (public.can_modify_use_case(use_case_id, auth.uid()));

CREATE POLICY "Submitter or admin updates approvals"
ON public.use_case_approvals FOR UPDATE TO authenticated
USING (public.is_use_case_admin(use_case_id, auth.uid()) OR public.can_modify_use_case(use_case_id, auth.uid()))
WITH CHECK (public.is_use_case_admin(use_case_id, auth.uid()) OR public.can_modify_use_case(use_case_id, auth.uid()));

CREATE POLICY "Admins delete approvals"
ON public.use_case_approvals FOR DELETE TO authenticated
USING (public.is_use_case_admin(use_case_id, auth.uid()));

CREATE TRIGGER trg_use_case_approvals_updated_at
BEFORE UPDATE ON public.use_case_approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
