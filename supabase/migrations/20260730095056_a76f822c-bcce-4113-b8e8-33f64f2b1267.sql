CREATE OR REPLACE FUNCTION public.search_users(_q text)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, status_emoji text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT id, username, display_name, avatar_url, status_emoji
  FROM public.profiles
  WHERE username IS NOT NULL
    AND (lower(username) LIKE lower(_q) || '%' OR lower(coalesce(display_name,'')) LIKE '%' || lower(_q) || '%')
  LIMIT 20;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _chat uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT c.id INTO _chat FROM public.chats c
   WHERE c.is_group = false
     AND EXISTS (SELECT 1 FROM public.chat_members m1 WHERE m1.chat_id=c.id AND m1.user_id=_me)
     AND EXISTS (SELECT 1 FROM public.chat_members m2 WHERE m2.chat_id=c.id AND m2.user_id=_other)
     AND (SELECT count(*) FROM public.chat_members m WHERE m.chat_id=c.id) = (CASE WHEN _me=_other THEN 1 ELSE 2 END)
   LIMIT 1;
  IF _chat IS NOT NULL THEN RETURN _chat; END IF;
  INSERT INTO public.chats(is_group, created_by) VALUES (false, _me) RETURNING id INTO _chat;
  INSERT INTO public.chat_members(chat_id, user_id) VALUES (_chat, _me) ON CONFLICT DO NOTHING;
  IF _other <> _me THEN
    INSERT INTO public.chat_members(chat_id, user_id) VALUES (_chat, _other) ON CONFLICT DO NOTHING;
  END IF;
  RETURN _chat;
END $function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM authenticated;