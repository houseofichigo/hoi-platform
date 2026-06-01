
CREATE OR REPLACE FUNCTION public.add_use_case_to_roadmap_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry public.roadmap_entries;
  v_priority numeric;
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT priority INTO v_priority
  FROM public.use_case_scores
  WHERE use_case_id = NEW.id
  ORDER BY updated_at DESC
  LIMIT 1;

  INSERT INTO public.roadmap_entries (
    workspace_id, use_case_id, owner_id, stage, priority_score, created_by
  )
  VALUES (
    NEW.workspace_id, NEW.id, NEW.created_by, 'backlog', v_priority, v_actor
  )
  ON CONFLICT (use_case_id) DO NOTHING
  RETURNING * INTO v_entry;

  IF v_entry.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.roadmap_stage_history (
    workspace_id, roadmap_entry_id, use_case_id, from_stage, to_stage, reason, changed_by
  ) VALUES (
    NEW.workspace_id, v_entry.id, NEW.id, NULL, 'backlog',
    'Approved in Build and added to Scale roadmap', v_actor
  );

  INSERT INTO public.audit_log (
    workspace_id, actor_id, action_type, entity_type, entity_id, entity_label, after_state, metadata
  ) VALUES (
    NEW.workspace_id, v_actor, 'roadmap_added', 'roadmap_entry', v_entry.id, NEW.name,
    to_jsonb(v_entry),
    jsonb_build_object('use_case_id', NEW.id, 'source', 'build_approval')
  );

  -- Notify the use case owner (skip if owner is the actor)
  IF NEW.created_by IS NOT NULL AND NEW.created_by <> COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (recipient_user_id, workspace_id, kind, payload)
    VALUES (
      NEW.created_by,
      NEW.workspace_id,
      'roadmap_added',
      jsonb_build_object(
        'use_case_id', NEW.id,
        'use_case_name', NEW.name,
        'roadmap_entry_id', v_entry.id
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
