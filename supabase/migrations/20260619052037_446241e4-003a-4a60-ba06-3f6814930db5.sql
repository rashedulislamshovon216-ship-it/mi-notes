
DROP POLICY IF EXISTS "own stories update" ON public.stories;
CREATE POLICY "owner updates story" ON public.stories FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_story_viewed(_story uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.stories
     SET viewers = (CASE WHEN viewers @> to_jsonb(auth.uid()::text)
                         THEN viewers
                         ELSE viewers || to_jsonb(auth.uid()::text) END)
   WHERE id = _story AND expires_at > now();
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_story_viewed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_story_viewed(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
