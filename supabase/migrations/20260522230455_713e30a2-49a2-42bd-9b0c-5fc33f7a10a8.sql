ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS workspace_profile jsonb,
  ADD COLUMN IF NOT EXISTS use_case_profile jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text;

COMMENT ON COLUMN workspaces.workspace_profile IS
  'Company-level profile (country, industry, activity, company_size, llm_platform). Set during onboarding.';
COMMENT ON COLUMN workspaces.use_case_profile IS
  'Use-case-specific profile keyed by worked_example. Shape: { [worked_example_id]: { ...fields } }. Set on first Assess entry per worked example.';
COMMENT ON COLUMN profiles.role IS
  'User role inside their company (e.g. "Head of Finance"). Per-user, not per-workspace.';