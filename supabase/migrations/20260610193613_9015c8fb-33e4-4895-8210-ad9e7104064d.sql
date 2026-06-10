
ALTER TABLE public.usernames
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_my_username_info()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'username', username,
    'auto_generated', auto_generated
  )
  FROM public.usernames
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_username(_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  trimmed text := trim(_username);
  taken_by uuid;
  previous_auto boolean;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trimmed !~ '^[A-Za-z0-9_-]{3,20}$' THEN
    RAISE EXCEPTION 'Username must be 3-20 characters: letters, numbers, underscore, hyphen';
  END IF;

  SELECT user_id INTO taken_by
  FROM public.usernames
  WHERE username_lower = lower(trimmed)
    AND user_id <> caller
  LIMIT 1;

  IF taken_by IS NOT NULL THEN
    RAISE EXCEPTION 'Username "%" is already taken', trimmed;
  END IF;

  SELECT auto_generated INTO previous_auto
  FROM public.usernames WHERE user_id = caller;

  INSERT INTO public.usernames (user_id, username, auto_generated)
  VALUES (caller, trimmed, false)
  ON CONFLICT (user_id) DO UPDATE
    SET username = EXCLUDED.username,
        auto_generated = false,
        updated_at = now();

  RETURN jsonb_build_object(
    'user_id', caller,
    'username', trimmed,
    'previous_auto_generated', COALESCE(previous_auto, false),
    'was_first_manual', COALESCE(previous_auto, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_username()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  existing record;
  candidate text;
  attempts int := 0;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_authenticated');
  END IF;

  SELECT username, auto_generated INTO existing
  FROM public.usernames WHERE user_id = caller;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'username', existing.username,
      'auto_generated', existing.auto_generated,
      'created', false
    );
  END IF;

  LOOP
    candidate := 'Trainer_' || lpad((floor(random() * 100000)::int)::text, 5, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.usernames WHERE username_lower = lower(candidate)
    );
    attempts := attempts + 1;
    IF attempts > 20 THEN
      candidate := 'Trainer_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.usernames (user_id, username, auto_generated)
  VALUES (caller, candidate, true);

  RETURN jsonb_build_object(
    'username', candidate,
    'auto_generated', true,
    'created', true
  );
END;
$$;
