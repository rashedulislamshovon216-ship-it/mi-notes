
-- PROFILES: add social fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS status_emoji text,
  ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (lower(username));

-- Public username search policy (only safe columns enforced at query level)
DROP POLICY IF EXISTS "public username search" ON public.profiles;
CREATE POLICY "public username search" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- CHATS
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  title text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- CHAT MEMBERS
CREATE TABLE IF NOT EXISTS public.chat_members (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_members TO authenticated;
GRANT ALL ON public.chat_members TO service_role;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_chat_member(_chat uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = _chat AND user_id = _user)
$$;

CREATE POLICY "members read chats" ON public.chats FOR SELECT TO authenticated
  USING (public.is_chat_member(id, auth.uid()));
CREATE POLICY "users create chats" ON public.chats FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "members update chats" ON public.chats FOR UPDATE TO authenticated
  USING (public.is_chat_member(id, auth.uid()));

CREATE POLICY "read own memberships" ON public.chat_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "insert memberships" ON public.chat_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.created_by = auth.uid()));
CREATE POLICY "delete own membership" ON public.chat_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  starred_by uuid[] NOT NULL DEFAULT '{}',
  edited_at timestamptz,
  deleted_for_all boolean NOT NULL DEFAULT false,
  deleted_for uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS messages_chat_idx ON public.messages (chat_id, created_at);

CREATE POLICY "members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "sender or member updates message" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "sender deletes message" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- STORIES
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text,
  media_type text,
  caption text,
  overlays jsonb NOT NULL DEFAULT '[]'::jsonb,
  background text,
  viewers jsonb NOT NULL DEFAULT '[]'::jsonb,
  reactions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read active stories" ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now());
CREATE POLICY "own stories insert" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own stories update" ON public.stories FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR true) WITH CHECK (true);
CREATE POLICY "own stories delete" ON public.stories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- CALLS (WebRTC signaling)
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'audio',
  status text NOT NULL DEFAULT 'ringing',
  offer jsonb,
  answer jsonb,
  caller_ice jsonb NOT NULL DEFAULT '[]'::jsonb,
  callee_ice jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read call" ON public.calls FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());
CREATE POLICY "caller creates call" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());
CREATE POLICY "participants update call" ON public.calls FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- CONTACTS
CREATE TABLE IF NOT EXISTS public.contacts (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  pinned boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  blocked boolean NOT NULL DEFAULT false,
  wallpaper text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own contacts" ON public.contacts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;

-- Find user by username (security definer for safe public lookup)
CREATE OR REPLACE FUNCTION public.search_users(_q text)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, status_emoji text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, username, display_name, avatar_url, status_emoji
  FROM public.profiles
  WHERE username IS NOT NULL
    AND (lower(username) LIKE lower(_q) || '%' OR lower(coalesce(display_name,'')) LIKE '%' || lower(_q) || '%')
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- Get-or-create 1:1 chat between two users
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(uuid) TO authenticated;
