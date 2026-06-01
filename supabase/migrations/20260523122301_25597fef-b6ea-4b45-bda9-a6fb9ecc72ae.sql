
-- Roll back the security-definer view and tighten via column grants + RPC instead.
DROP VIEW IF EXISTS public.audit_log_safe;

-- Restore the broad SELECT policy for members (column grants will hide diffs).
DROP POLICY IF EXISTS "Admins view audit log" ON public.audit_log;
CREATE POLICY "Members view audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Column-level: revoke before_state / after_state from the regular authenticated role.
REVOKE SELECT (before_state, after_state) ON public.audit_log FROM authenticated;
-- (no GRANT back — admins read diffs through the SECURITY DEFINER RPC below.)

-- Admin-only RPC to return the full audit row including diffs.
CREATE OR REPLACE FUNCTION public.get_audit_log_with_diffs(
  p_workspace_id uuid,
  p_limit int DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  actor_id uuid,
  action_type text,
  entity_type text,
  entity_id uuid,
  entity_label text,
  metadata jsonb,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_workspace_role(p_workspace_id, auth.uid(), ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Only workspace admins can read full audit diffs';
  END IF;

  RETURN QUERY
    SELECT a.id, a.workspace_id, a.actor_id, a.action_type, a.entity_type,
           a.entity_id, a.entity_label, a.metadata,
           a.before_state, a.after_state, a.created_at
    FROM public.audit_log a
    WHERE a.workspace_id = p_workspace_id
    ORDER BY a.created_at DESC
    LIMIT GREATEST(LEAST(p_limit, 2000), 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_audit_log_with_diffs(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_audit_log_with_diffs(uuid, int) TO authenticated;
