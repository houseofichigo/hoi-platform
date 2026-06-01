
-- assess_progress
CREATE TABLE public.assess_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','complete')),
  studied boolean NOT NULL DEFAULT false,
  current_step integer,
  max_step_reached integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, module_id)
);
ALTER TABLE public.assess_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own progress; admins read all"
  ON public.assess_progress FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  );
CREATE POLICY "Members insert own progress"
  ON public.assess_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Members update own progress"
  ON public.assess_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members delete own; admins delete any"
  ON public.assess_progress FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  );

CREATE TRIGGER assess_progress_set_updated_at
  BEFORE UPDATE ON public.assess_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX assess_progress_workspace_idx ON public.assess_progress(workspace_id);
CREATE INDEX assess_progress_user_idx ON public.assess_progress(workspace_id, user_id);

-- assess_outputs
CREATE TABLE public.assess_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  output_key text NOT NULL,
  value jsonb NOT NULL,
  seeded boolean NOT NULL DEFAULT false,
  touched boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, output_key)
);
ALTER TABLE public.assess_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own outputs; admins read all"
  ON public.assess_outputs FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  );
CREATE POLICY "Members insert own outputs"
  ON public.assess_outputs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Members update own outputs"
  ON public.assess_outputs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members delete own; admins delete any outputs"
  ON public.assess_outputs FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  );

CREATE TRIGGER assess_outputs_set_updated_at
  BEFORE UPDATE ON public.assess_outputs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX assess_outputs_workspace_user_idx ON public.assess_outputs(workspace_id, user_id);

-- assess_gate_decisions
CREATE TABLE public.assess_gate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gate_number integer NOT NULL CHECK (gate_number IN (1,2,3)),
  module_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('continue','constraints','improve','stop')),
  justification text NOT NULL,
  criteria_responses jsonb NOT NULL,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationales jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, gate_number)
);
ALTER TABLE public.assess_gate_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own gate decisions; admins read all"
  ON public.assess_gate_decisions FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  );
CREATE POLICY "Members insert own gate decisions"
  ON public.assess_gate_decisions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Members update own gate decisions"
  ON public.assess_gate_decisions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members delete own; admins delete any gate decisions"
  ON public.assess_gate_decisions FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  );

CREATE INDEX assess_gate_decisions_workspace_user_idx ON public.assess_gate_decisions(workspace_id, user_id);
