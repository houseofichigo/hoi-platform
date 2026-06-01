ALTER TABLE public.use_cases DROP CONSTRAINT IF EXISTS use_cases_function_check;
ALTER TABLE public.use_cases ADD CONSTRAINT use_cases_function_check
  CHECK (function = ANY (ARRAY['finance','operations','sales','marketing','customer_success','customer_ops','hr','procurement','legal','it','product','other']));