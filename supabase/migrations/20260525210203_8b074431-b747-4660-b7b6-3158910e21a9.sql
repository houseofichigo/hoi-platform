DO $$
DECLARE
  v_user_id uuid;
  v_updated int;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower('sabri@houseofichigo.com');

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row for sabri@houseofichigo.com — ask them to sign in once, then re-run.';
  END IF;

  UPDATE public.profiles
     SET role = 'super_admin',
         updated_at = now()
   WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'No profiles row for sabri@houseofichigo.com (user_id=%) — sign in once to create the profile, then re-run.', v_user_id;
  END IF;
END $$;