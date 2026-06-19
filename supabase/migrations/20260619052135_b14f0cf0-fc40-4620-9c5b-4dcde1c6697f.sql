
-- Avatars: each user owns folder = their uid; anyone signed in can read avatars
CREATE POLICY "avatars read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Stories: signed-in users can read; owner writes in their folder
CREATE POLICY "stories read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories');
CREATE POLICY "stories own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "stories own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Chat media: signed-in users read (URLs are unguessable); owner uploads in their folder
CREATE POLICY "chat media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');
CREATE POLICY "chat media own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat media own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
