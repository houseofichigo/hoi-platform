
ALTER TABLE public.use_cases
  ADD COLUMN IF NOT EXISTS capture_v2 jsonb,
  ADD COLUMN IF NOT EXISTS derived_scores jsonb,
  ADD COLUMN IF NOT EXISTS lifecycle_history jsonb NOT NULL DEFAULT '[]'::jsonb;
