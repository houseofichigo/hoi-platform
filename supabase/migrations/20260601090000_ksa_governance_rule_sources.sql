-- Saudi-market governance rule sources.
-- Keeps existing historical EU/GDPR values readable while allowing the KSA
-- taxonomy used by the client-ready governance engine.

ALTER TABLE public.governance_flags
  DROP CONSTRAINT IF EXISTS governance_flags_rule_source_check;

ALTER TABLE public.governance_flags
  ADD CONSTRAINT governance_flags_rule_source_check
  CHECK (
    rule_source IN (
      'sdaia',
      'pdpl',
      'ndmo',
      'nca_sama',
      'saip',
      'internal_policy',
      'eu_ai_act',
      'gdpr'
    )
  );
