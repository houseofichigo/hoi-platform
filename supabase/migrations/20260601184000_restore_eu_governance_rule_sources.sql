-- Restore the active HOI governance taxonomy to the EU/HOI rule sources.
-- If a temporary non-EU migration was applied, this migration narrows
-- future writes back to EU AI Act, GDPR, and internal policy.

ALTER TABLE public.governance_flags
  DROP CONSTRAINT IF EXISTS governance_flags_rule_source_check;

WITH mapped AS (
  SELECT
    id,
    use_case_id,
    rule_code,
    severity,
    updated_at,
    created_at,
    CASE
      WHEN rule_code = 'SDAIA_HIGH_IMPACT_AI' THEN 'EU_AI_ACT_HIGH_RISK'
      WHEN rule_code = 'SDAIA_HUMAN_OVERSIGHT_REQUIRED' THEN 'HITL_REQUIRED_ART14'
      WHEN rule_code = 'SDAIA_TRANSPARENCY_REQUIRED' THEN 'TRANSPARENCY_ART13'
      WHEN rule_code = 'SDAIA_TECHNICAL_DOCUMENTATION' THEN 'ARTICLE_11_DOCUMENTATION'
      WHEN rule_code = 'SDAIA_MODEL_VALIDATION_REQUIRED' THEN 'CONFORMITY_ASSESSMENT'
      WHEN rule_code = 'PDPL_PRIVACY_IMPACT_REVIEW' THEN 'DPIA_REQUIRED'
      WHEN rule_code = 'PDPL_DATA_MINIMISATION' THEN 'DATA_MINIMISATION'
      WHEN rule_code = 'PDPL_CROSS_BORDER_REVIEW' THEN 'DPIA_REQUIRED'
      WHEN rule_code = 'NDMO_DATA_GOVERNANCE_REVIEW' THEN 'DATA_MINIMISATION'
      WHEN rule_code = 'NCA_SAMA_SECURITY_REVIEW' THEN 'SECURITY_REVIEW_REQUIRED'
      WHEN rule_code = 'SAIP_IP_REVIEW' THEN 'SECURITY_REVIEW_REQUIRED'
      ELSE rule_code
    END AS target_rule_code
  FROM public.governance_flags
),
ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY use_case_id, target_rule_code
      ORDER BY
        (rule_code = target_rule_code) DESC,
        CASE severity
          WHEN 'hard_stop' THEN 3
          WHEN 'requires_action' THEN 2
          ELSE 1
        END DESC,
        updated_at DESC,
        created_at DESC
    ) AS rn
  FROM mapped
)
DELETE FROM public.governance_flags
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE public.governance_flags
SET
  rule_source = CASE
    WHEN rule_source = 'sdaia' THEN 'eu_ai_act'
    WHEN rule_source = 'pdpl' THEN 'gdpr'
    WHEN rule_source IN ('ndmo', 'nca_sama', 'saip') THEN 'internal_policy'
    ELSE rule_source
  END,
  rule_code = CASE
    WHEN rule_code = 'SDAIA_HIGH_IMPACT_AI' THEN 'EU_AI_ACT_HIGH_RISK'
    WHEN rule_code = 'SDAIA_HUMAN_OVERSIGHT_REQUIRED' THEN 'HITL_REQUIRED_ART14'
    WHEN rule_code = 'SDAIA_TRANSPARENCY_REQUIRED' THEN 'TRANSPARENCY_ART13'
    WHEN rule_code = 'SDAIA_TECHNICAL_DOCUMENTATION' THEN 'ARTICLE_11_DOCUMENTATION'
    WHEN rule_code = 'SDAIA_MODEL_VALIDATION_REQUIRED' THEN 'CONFORMITY_ASSESSMENT'
    WHEN rule_code = 'PDPL_PRIVACY_IMPACT_REVIEW' THEN 'DPIA_REQUIRED'
    WHEN rule_code = 'PDPL_DATA_MINIMISATION' THEN 'DATA_MINIMISATION'
    WHEN rule_code = 'PDPL_CROSS_BORDER_REVIEW' THEN 'DPIA_REQUIRED'
    WHEN rule_code = 'NDMO_DATA_GOVERNANCE_REVIEW' THEN 'DATA_MINIMISATION'
    WHEN rule_code = 'NCA_SAMA_SECURITY_REVIEW' THEN 'SECURITY_REVIEW_REQUIRED'
    WHEN rule_code = 'SAIP_IP_REVIEW' THEN 'SECURITY_REVIEW_REQUIRED'
    ELSE rule_code
  END
WHERE rule_source IN ('sdaia', 'pdpl', 'ndmo', 'nca_sama', 'saip')
   OR rule_code IN (
    'SDAIA_HIGH_IMPACT_AI',
    'SDAIA_HUMAN_OVERSIGHT_REQUIRED',
    'SDAIA_TRANSPARENCY_REQUIRED',
    'SDAIA_TECHNICAL_DOCUMENTATION',
    'SDAIA_MODEL_VALIDATION_REQUIRED',
    'PDPL_PRIVACY_IMPACT_REVIEW',
    'PDPL_DATA_MINIMISATION',
    'PDPL_CROSS_BORDER_REVIEW',
    'NDMO_DATA_GOVERNANCE_REVIEW',
    'NCA_SAMA_SECURITY_REVIEW',
    'SAIP_IP_REVIEW'
  );

ALTER TABLE public.governance_flags
  ADD CONSTRAINT governance_flags_rule_source_check
  CHECK (rule_source IN ('eu_ai_act', 'gdpr', 'internal_policy'));
