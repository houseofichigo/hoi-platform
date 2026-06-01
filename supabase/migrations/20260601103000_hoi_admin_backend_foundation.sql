-- House of Ichigo internal admin backend foundation.
-- This is separate from customer workspace administration.

CREATE TABLE IF NOT EXISTS public.hoi_admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','content_editor','support','billing_admin','read_only')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS hoi_admin_users_set_updated_at ON public.hoi_admin_users;
CREATE TRIGGER hoi_admin_users_set_updated_at
BEFORE UPDATE ON public.hoi_admin_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate the previous bootstrap role into the dedicated admin table.
INSERT INTO public.hoi_admin_users (user_id, role, status, created_by)
SELECT user_id, 'owner', 'active', user_id
FROM public.profiles
WHERE role = 'super_admin'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role,
    status = 'active',
    updated_at = now();

CREATE OR REPLACE FUNCTION public.is_hoi_admin(_user_id uuid, _roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hoi_admin_users
    WHERE user_id = _user_id
      AND status = 'active'
      AND (_roles IS NULL OR role = ANY(_roles))
  )
$$;

-- Backwards-compatible helper for existing RLS/code. It no longer trusts profiles.role.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_hoi_admin(_user_id, ARRAY['owner','admin'])
$$;

-- profiles.role is legacy and must not be a self-service privilege field.
CREATE OR REPLACE FUNCTION public.protect_profiles_legacy_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_hoi_admin(auth.uid(), ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'Only House of Ichigo admins can change legacy profile roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_legacy_role ON public.profiles;
CREATE TRIGGER profiles_protect_legacy_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_legacy_role();

ALTER TABLE public.hoi_admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOI admins can read admin users"
ON public.hoi_admin_users FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI owners and admins can insert admin users"
ON public.hoi_admin_users FOR INSERT
TO authenticated
WITH CHECK (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "HOI owners and admins can update admin users"
ON public.hoi_admin_users FOR UPDATE
TO authenticated
USING (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin']))
WITH CHECK (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "HOI owners can delete admin users"
ON public.hoi_admin_users FOR DELETE
TO authenticated
USING (public.is_hoi_admin(auth.uid(), ARRAY['owner']));

-- Let HOI admins inspect customer data in the internal console without joining every workspace.
CREATE POLICY "HOI admins can read all workspaces"
ON public.workspaces FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI admins can read all workspace members"
ON public.workspace_members FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

DO $$
BEGIN
  IF to_regclass('public.workspace_invitations') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "HOI admins can read all workspace invitations"
      ON public.workspace_invitations FOR SELECT
      TO authenticated
      USING (public.is_hoi_admin(auth.uid()))';
  END IF;

  IF to_regclass('public.use_cases') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "HOI admins can read all use cases"
      ON public.use_cases FOR SELECT
      TO authenticated
      USING (public.is_hoi_admin(auth.uid()))';
  END IF;

  IF to_regclass('public.use_case_approvals') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "HOI admins can read all use case approvals"
      ON public.use_case_approvals FOR SELECT
      TO authenticated
      USING (public.is_hoi_admin(auth.uid()))';
  END IF;

  IF to_regclass('public.governance_flags') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "HOI admins can read all governance flags"
      ON public.governance_flags FOR SELECT
      TO authenticated
      USING (public.is_hoi_admin(auth.uid()))';
  END IF;
END $$;

-- Library editorial workflow fields.
ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS editorial_status text NOT NULL DEFAULT 'draft'
    CHECK (editorial_status IN ('draft','in_review','published','archived')),
  ADD COLUMN IF NOT EXISTS content_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.library_items
SET editorial_status = CASE
    WHEN published THEN 'published'
    ELSE editorial_status
  END,
  published_at = CASE
    WHEN published AND published_at IS NULL THEN COALESCE(updated_at, created_at, now())
    ELSE published_at
  END;

CREATE INDEX IF NOT EXISTS library_items_editorial_status_idx
ON public.library_items (editorial_status);

DROP POLICY IF EXISTS "Super-admins can read all library items" ON public.library_items;
DROP POLICY IF EXISTS "Super-admins can insert library items" ON public.library_items;
DROP POLICY IF EXISTS "Super-admins can update library items" ON public.library_items;
DROP POLICY IF EXISTS "Super-admins can delete library items" ON public.library_items;

CREATE POLICY "HOI admins can read all library items"
ON public.library_items FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI content admins can insert library items"
ON public.library_items FOR INSERT
TO authenticated
WITH CHECK (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor']));

CREATE POLICY "HOI content admins can update library items"
ON public.library_items FOR UPDATE
TO authenticated
USING (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor']))
WITH CHECK (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor']));

CREATE POLICY "HOI owners and admins can delete library items"
ON public.library_items FOR DELETE
TO authenticated
USING (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin']));

DROP POLICY IF EXISTS "Super-admins can upload library-files" ON storage.objects;
DROP POLICY IF EXISTS "Super-admins can update library-files" ON storage.objects;
DROP POLICY IF EXISTS "Super-admins can delete library-files" ON storage.objects;

CREATE POLICY "HOI content admins can upload library-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'library-files'
  AND public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor'])
);

CREATE POLICY "HOI content admins can update library-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'library-files'
  AND public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor'])
)
WITH CHECK (
  bucket_id = 'library-files'
  AND public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor'])
);

CREATE POLICY "HOI content admins can delete library-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'library-files'
  AND public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor'])
);

CREATE OR REPLACE FUNCTION public.sync_library_item_editorial_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.published := NEW.editorial_status = 'published';

  IF NEW.editorial_status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  IF NEW.editorial_status = 'archived' AND NEW.archived_at IS NULL THEN
    NEW.archived_at := now();
  END IF;

  IF NEW.editorial_status <> 'archived' THEN
    NEW.archived_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_items_sync_editorial_state ON public.library_items;
CREATE TRIGGER library_items_sync_editorial_state
BEFORE INSERT OR UPDATE ON public.library_items
FOR EACH ROW EXECUTE FUNCTION public.sync_library_item_editorial_state();

CREATE TABLE IF NOT EXISTS public.library_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_item_versions_item_idx
ON public.library_item_versions (library_item_id, version DESC);

ALTER TABLE public.library_item_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOI admins can read library versions"
ON public.library_item_versions FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI admins can insert library versions"
ON public.library_item_versions FOR INSERT
TO authenticated
WITH CHECK (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','content_editor']));

-- Future billing and Stripe readiness.
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  stripe_price_id text,
  seat_limit integer,
  monthly_price_cents integer,
  currency text NOT NULL DEFAULT 'usd',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS plans_set_updated_at ON public.plans;
CREATE TRIGGER plans_set_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plans (id, name, description, seat_limit, monthly_price_cents, active)
VALUES
  ('free', 'Free', 'Starter workspace for evaluation.', 3, 0, true),
  ('team', 'Team', 'Team plan placeholder for future Stripe checkout.', 25, NULL, true),
  ('enterprise', 'Enterprise', 'Custom advisory and operating model plan.', NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'manual' CHECK (status IN ('manual','trialing','active','past_due','canceled','unpaid','incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  seat_limit integer,
  price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

DROP TRIGGER IF EXISTS workspace_subscriptions_set_updated_at ON public.workspace_subscriptions;
CREATE TRIGGER workspace_subscriptions_set_updated_at
BEFORE UPDATE ON public.workspace_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  stripe_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOI admins can read plans"
ON public.plans FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI billing admins can manage plans"
ON public.plans FOR ALL
TO authenticated
USING (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','billing_admin']))
WITH CHECK (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','billing_admin']));

CREATE POLICY "HOI admins can read workspace subscriptions"
ON public.workspace_subscriptions FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI billing admins can manage workspace subscriptions"
ON public.workspace_subscriptions FOR ALL
TO authenticated
USING (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','billing_admin']))
WITH CHECK (public.is_hoi_admin(auth.uid(), ARRAY['owner','admin','billing_admin']));

CREATE POLICY "HOI admins can read billing events"
ON public.billing_events FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

-- Internal admin audit and notes.
CREATE TABLE IF NOT EXISTS public.hoi_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_label text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hoi_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOI admins can read admin audit log"
ON public.hoi_admin_audit_log FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI admins can insert admin audit log"
ON public.hoi_admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.is_hoi_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.hoi_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('user','workspace','library_item','billing','support')),
  entity_id text NOT NULL,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS hoi_admin_notes_set_updated_at ON public.hoi_admin_notes;
CREATE TRIGGER hoi_admin_notes_set_updated_at
BEFORE UPDATE ON public.hoi_admin_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hoi_admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOI admins can read admin notes"
ON public.hoi_admin_notes FOR SELECT
TO authenticated
USING (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI admins can insert admin notes"
ON public.hoi_admin_notes FOR INSERT
TO authenticated
WITH CHECK (public.is_hoi_admin(auth.uid()));

CREATE POLICY "HOI admins can update admin notes"
ON public.hoi_admin_notes FOR UPDATE
TO authenticated
USING (public.is_hoi_admin(auth.uid()))
WITH CHECK (public.is_hoi_admin(auth.uid()));
