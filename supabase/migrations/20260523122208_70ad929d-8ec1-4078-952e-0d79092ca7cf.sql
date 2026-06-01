
-- 1) use_cases: tighten UPDATE
DROP POLICY IF EXISTS "Creators or admins can update use cases" ON public.use_cases;

CREATE POLICY "Admins update any use case"
  ON public.use_cases
  FOR UPDATE
  TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::text, 'admin'::text]))
  WITH CHECK (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::text, 'admin'::text]));

CREATE POLICY "Creators update own use case (non-final states)"
  ON public.use_cases
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (
    created_by = auth.uid()
    AND status = ANY (ARRAY['draft','capturing','ready_to_score','scored','submitted','archived'])
  );

-- 2) use_case_approvals: tighten UPDATE
DROP POLICY IF EXISTS "Submitter or admin updates approvals" ON public.use_case_approvals;

CREATE POLICY "Admins update approval decisions"
  ON public.use_case_approvals
  FOR UPDATE
  TO authenticated
  USING (is_use_case_admin(use_case_id, auth.uid()))
  WITH CHECK (is_use_case_admin(use_case_id, auth.uid()));

CREATE POLICY "Submitter updates own approval (pending only)"
  ON public.use_case_approvals
  FOR UPDATE
  TO authenticated
  USING (can_modify_use_case(use_case_id, auth.uid()))
  WITH CHECK (
    can_modify_use_case(use_case_id, auth.uid())
    AND decision = 'pending'
  );

-- 3) governance_flags: admin-only UPDATE
DROP POLICY IF EXISTS "Admins or assignee update governance flags" ON public.governance_flags;

CREATE POLICY "Admins update governance flags"
  ON public.governance_flags
  FOR UPDATE
  TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::text, 'admin'::text]))
  WITH CHECK (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::text, 'admin'::text]));

-- 4) audit_log: restrict full-row reads to admins, expose safe view for members
DROP POLICY IF EXISTS "Members view audit log" ON public.audit_log;

CREATE POLICY "Admins view audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::text, 'admin'::text]));

-- View that omits before_state / after_state. security_invoker=false (default for new views)
-- means the view runs as its owner and bypasses the underlying RLS; the view's own
-- WHERE clause restricts rows to workspace members.
DROP VIEW IF EXISTS public.audit_log_safe;
CREATE VIEW public.audit_log_safe
WITH (security_invoker = false) AS
SELECT
  id,
  workspace_id,
  actor_id,
  action_type,
  entity_type,
  entity_id,
  entity_label,
  metadata,
  created_at
FROM public.audit_log
WHERE is_workspace_member(workspace_id, auth.uid());

GRANT SELECT ON public.audit_log_safe TO authenticated;
