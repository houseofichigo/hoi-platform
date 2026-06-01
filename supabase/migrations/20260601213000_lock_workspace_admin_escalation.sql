-- Lock client-side workspace admin escalation.
-- House of Ichigo internal admins promote owners/admins through audited server functions.

CREATE OR REPLACE FUNCTION public.enforce_workspace_role_escalation_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Server-side service-role functions remain the privileged path for HOI operations.
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- HOI owners/admins may perform controlled operations from internal tooling.
  IF public.is_hoi_admin(auth.uid(), ARRAY['owner','admin']) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'workspace_members' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role IN ('member', 'viewer') THEN
        RETURN NEW;
      END IF;

      -- Keep the existing first-owner bootstrap path for brand-new workspaces.
      IF NEW.user_id = auth.uid()
         AND NEW.role = 'owner'
         AND NOT EXISTS (
           SELECT 1
           FROM public.workspace_members m
           WHERE m.workspace_id = NEW.workspace_id
         ) THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Workspace owner/admin roles are managed by House of Ichigo';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Workspace owner/admin roles are managed by House of Ichigo';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'workspace_invitations' AND NEW.role NOT IN ('member', 'viewer') THEN
    RAISE EXCEPTION 'Workspace owner/admin invitations are managed by House of Ichigo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_members_role_escalation_guard ON public.workspace_members;
CREATE TRIGGER workspace_members_role_escalation_guard
BEFORE INSERT OR UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_role_escalation_limits();

DROP TRIGGER IF EXISTS workspace_invitations_role_escalation_guard ON public.workspace_invitations;
CREATE TRIGGER workspace_invitations_role_escalation_guard
BEFORE INSERT OR UPDATE ON public.workspace_invitations
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_role_escalation_limits();

DROP POLICY IF EXISTS "Owners/admins can add members; creator can seat first owner"
ON public.workspace_members;

CREATE POLICY "Workspace admins can add members and viewers; creator can seat first owner"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
    AND role IN ('member','viewer')
  )
  OR (
    user_id = auth.uid()
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspace_members.workspace_id
    )
  )
);

DROP POLICY IF EXISTS "Owners/admins can update members; users can update self"
ON public.workspace_members;

-- Intentionally no client UPDATE policy for workspace_members.
-- Role updates go through HOI-admin server functions using service role.

DROP POLICY IF EXISTS "Owners/admins can remove members; users can remove themselves"
ON public.workspace_members;

CREATE POLICY "Workspace admins can remove members and viewers; members can leave"
ON public.workspace_members FOR DELETE
TO authenticated
USING (
  (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
    AND role IN ('member','viewer')
  )
  OR (
    user_id = auth.uid()
    AND role IN ('member','viewer')
  )
);

DROP POLICY IF EXISTS "Owners/admins can create invitations"
ON public.workspace_invitations;

CREATE POLICY "Workspace admins can create member and viewer invitations"
ON public.workspace_invitations FOR INSERT
TO authenticated
WITH CHECK (
  public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  AND role IN ('member','viewer')
);

DROP POLICY IF EXISTS "Owners/admins or invited user can update invitations"
ON public.workspace_invitations;

CREATE POLICY "Workspace admins or invited user can update member and viewer invitations"
ON public.workspace_invitations FOR UPDATE
TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
  OR lower(email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
)
WITH CHECK (
  role IN ('member','viewer')
  AND (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin'])
    OR lower(email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
  )
);
