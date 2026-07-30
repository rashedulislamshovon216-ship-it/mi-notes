CREATE OR REPLACE FUNCTION public.mark_story_viewed(_story uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.stories
     SET viewers = (CASE WHEN viewers @> to_jsonb(auth.uid()::text)
                         THEN viewers
                         ELSE viewers || to_jsonb(auth.uid()::text) END)
   WHERE id = _story AND expires_at > now();
END $function$;

REVOKE UPDATE ON public.stories FROM authenticated;
GRANT UPDATE(viewers, reactions) ON public.stories TO authenticated;

DROP POLICY IF EXISTS "owner updates story" ON public.stories;
CREATE POLICY "active story engagement update"
ON public.stories
FOR UPDATE
TO authenticated
USING (expires_at > now())
WITH CHECK (expires_at > now());