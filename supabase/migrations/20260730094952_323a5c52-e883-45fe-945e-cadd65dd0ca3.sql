GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;

GRANT SELECT, INSERT, DELETE ON public.chat_members TO authenticated;
GRANT ALL ON public.chat_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_story_viewed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;