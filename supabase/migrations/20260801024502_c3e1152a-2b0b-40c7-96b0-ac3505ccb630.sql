GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calls TO authenticated;

GRANT ALL ON TABLE public.profiles, public.chats, public.chat_members, public.messages, public.contacts, public.stories, public.calls TO service_role;

GRANT EXECUTE ON FUNCTION public.get_or_create_dm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_story_viewed(uuid) TO authenticated;