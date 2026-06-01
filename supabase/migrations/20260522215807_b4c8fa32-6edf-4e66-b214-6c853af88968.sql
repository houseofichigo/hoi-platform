ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS worked_example text NULL,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz NULL;

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_worked_example_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_worked_example_check
  CHECK (worked_example IS NULL OR worked_example IN ('invoice_ocr','devis_generation','hr_ticket_triage','customer_email','custom'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS library_visited_at timestamptz NULL;