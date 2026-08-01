CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_chat_member(_chat uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = _chat AND user_id = _user
  )
$$;
REVOKE ALL ON FUNCTION private.is_chat_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_chat_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "read own memberships" ON public.chat_members;
CREATE POLICY "read own memberships"
ON public.chat_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS "members read chats" ON public.chats;
CREATE POLICY "members read chats"
ON public.chats FOR SELECT TO authenticated
USING (private.is_chat_member(id, auth.uid()));

DROP POLICY IF EXISTS "members update chats" ON public.chats;
CREATE POLICY "members update chats"
ON public.chats FOR UPDATE TO authenticated
USING (private.is_chat_member(id, auth.uid()))
WITH CHECK (private.is_chat_member(id, auth.uid()));

DROP POLICY IF EXISTS "members read messages" ON public.messages;
CREATE POLICY "members read messages"
ON public.messages FOR SELECT TO authenticated
USING (private.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS "members send messages" ON public.messages;
CREATE POLICY "members send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND private.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS "sender or member updates message" ON public.messages;
CREATE POLICY "sender or member updates message"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid() OR private.is_chat_member(chat_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private
AS $$
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
END
$$;

REVOKE ALL ON FUNCTION public.is_chat_member(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_chat_member(uuid, uuid) FROM PUBLIC;
DROP FUNCTION public.is_chat_member(uuid, uuid);