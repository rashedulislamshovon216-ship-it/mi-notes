/**
 * Cloud data layer — real users, real chats, real realtime.
 * Table names stay camouflaged-ish; all access is RLS-scoped to the signed-in user.
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface CloudProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  status_emoji: string | null;
  last_seen: string | null;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  reply_to: string | null;
  reactions: Record<string, string[]>;
  starred_by: string[];
  edited_at: string | null;
  deleted_for_all: boolean;
  deleted_for: string[];
  created_at: string;
  pending?: boolean;
}

export interface ChatSummary {
  chatId: string;
  isSelf: boolean;
  other: CloudProfile | null;
  last: MessageRow | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
  nickname: string | null;
}

export interface StoryRow {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  overlays: unknown;
  background: string | null;
  viewers: string[];
  reactions: { user: string; emoji: string }[];
  created_at: string;
  expires_at: string;
}

/* ------------------------------- auth ------------------------------- */

export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function myProfile(): Promise<CloudProfile | null> {
  const u = await currentUser();
  if (!u) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CloudProfile) ?? null;
}

export async function saveProfile(patch: Partial<CloudProfile>) {
  const u = await currentUser();
  if (!u) return { error: "Not signed in" };
  const { error } = await supabase.from("profiles").update(patch).eq("id", u.id);
  return { error: error?.message ?? null };
}

export async function touchPresence() {
  const u = await currentUser();
  if (!u) return;
  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", u.id);
}

/* ------------------------------ people ------------------------------ */

export async function searchPeople(q: string): Promise<CloudProfile[]> {
  const term = q.trim().replace(/^@/, "");
  if (term.length < 2) return [];
  const { data } = await supabase.rpc("search_users", { _q: term });
  return (data ?? []) as CloudProfile[];
}

export async function startDm(otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_or_create_dm", { _other: otherId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getChatSummary(chatId: string): Promise<ChatSummary | null> {
  const u = await currentUser();
  if (!u) return null;
  const { data: memberRows, error: memberError } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("chat_id", chatId);
  if (memberError) throw new Error(memberError.message);
  const peers = (memberRows ?? []).map((row) => row.user_id);
  if (!peers.includes(u.id)) return null;
  const otherId = peers.find((id) => id !== u.id) ?? u.id;
  const [{ data: profile, error: profileError }, { data: contact, error: contactError }, { data: last, error: lastError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", otherId).maybeSingle(),
    supabase.from("contacts").select("*").eq("owner_id", u.id).eq("contact_id", otherId).maybeSingle(),
    supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const error = profileError ?? contactError ?? lastError;
  if (error) throw new Error(error.message);
  return {
    chatId,
    isSelf: otherId === u.id,
    other: (profile as CloudProfile | null) ?? null,
    last: (last as MessageRow | null) ?? null,
    unread: 0,
    pinned: contact?.pinned ?? false,
    muted: contact?.muted ?? false,
    nickname: contact?.nickname ?? null,
  };
}

/* ------------------------------- chats ------------------------------ */

export async function listChats(): Promise<ChatSummary[]> {
  const u = await currentUser();
  if (!u) return [];

  const { data: memberships, error: membershipsError } = await supabase
    .from("chat_members")
    .select("chat_id")
    .eq("user_id", u.id);
  if (membershipsError) throw new Error(membershipsError.message);
  const chatIds = (memberships ?? []).map((m) => m.chat_id);
  if (!chatIds.length) return [];

  const [{ data: members, error: membersError }, { data: msgs, error: messagesError }, { data: contacts, error: contactsError }] = await Promise.all([
    supabase.from("chat_members").select("chat_id, user_id").in("chat_id", chatIds),
    supabase.from("messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: false }).limit(400),
    supabase.from("contacts").select("*").eq("owner_id", u.id),
  ]);
  const listError = membersError ?? messagesError ?? contactsError;
  if (listError) throw new Error(listError.message);

  const otherIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: profs, error: profilesError } = await supabase.from("profiles").select("*").in("id", otherIds.length ? otherIds : [u.id]);
  if (profilesError) throw new Error(profilesError.message);
  const profById = new Map((profs ?? []).map((p) => [p.id, p as CloudProfile]));
  const contactById = new Map((contacts ?? []).map((c) => [c.contact_id, c]));

  return chatIds
    .map((chatId): ChatSummary => {
      const peers = (members ?? []).filter((m) => m.chat_id === chatId).map((m) => m.user_id);
      const otherId = peers.find((p) => p !== u.id) ?? u.id;
      const isSelf = otherId === u.id;
      const chatMsgs = (msgs ?? []).filter((m) => m.chat_id === chatId) as MessageRow[];
      const c = contactById.get(otherId);
      return {
        chatId,
        isSelf,
        other: profById.get(otherId) ?? null,
        last: chatMsgs[0] ?? null,
        unread: 0,
        pinned: c?.pinned ?? false,
        muted: c?.muted ?? false,
        nickname: c?.nickname ?? null,
      };
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (
        new Date(b.last?.created_at ?? 0).getTime() - new Date(a.last?.created_at ?? 0).getTime()
      );
    });
}

export async function setContactFlag(
  contactId: string,
  patch: { pinned?: boolean; muted?: boolean; blocked?: boolean; nickname?: string | null; wallpaper?: string | null },
) {
  const u = await currentUser();
  if (!u) return;
  await supabase.from("contacts").upsert(
    { owner_id: u.id, contact_id: contactId, ...patch },
    { onConflict: "owner_id,contact_id" },
  );
}

/* ----------------------------- messages ----------------------------- */

export async function listMessages(chatId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageRow[];
}

export async function sendMessage(input: {
  chatId: string;
  body?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  replyTo?: string | null;
}): Promise<MessageRow | null> {
  const u = await currentUser();
  if (!u) return null;
  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: input.chatId,
      sender_id: u.id,
      body: input.body ?? null,
      attachment_url: input.attachmentUrl ?? null,
      attachment_type: input.attachmentType ?? null,
      attachment_name: input.attachmentName ?? null,
      reply_to: input.replyTo ?? null,
    })
    .select()
    .single();
  if (error) return null;
  await supabase.from("chats").update({ last_message_at: new Date().toISOString() }).eq("id", input.chatId);
  return data as MessageRow;
}

export async function editMessage(id: string, body: string) {
  await supabase.from("messages").update({ body, edited_at: new Date().toISOString() }).eq("id", id);
}

export async function deleteMessage(id: string, forEveryone: boolean) {
  const u = await currentUser();
  if (!u) return;
  if (forEveryone) {
    await supabase.from("messages").update({ deleted_for_all: true, body: null, attachment_url: null }).eq("id", id);
  } else {
    const { data } = await supabase.from("messages").select("deleted_for").eq("id", id).maybeSingle();
    const next = [...new Set([...(data?.deleted_for ?? []), u.id])];
    await supabase.from("messages").update({ deleted_for: next }).eq("id", id);
  }
}

export async function toggleReaction(m: MessageRow, emoji: string) {
  const u = await currentUser();
  if (!u) return;
  const reactions: Record<string, string[]> = { ...(m.reactions ?? {}) };
  const list = reactions[emoji] ?? [];
  reactions[emoji] = list.includes(u.id) ? list.filter((x) => x !== u.id) : [...list, u.id];
  if (!reactions[emoji].length) delete reactions[emoji];
  await supabase.from("messages").update({ reactions }).eq("id", m.id);
}

export async function toggleStar(m: MessageRow) {
  const u = await currentUser();
  if (!u) return;
  const cur = m.starred_by ?? [];
  const next = cur.includes(u.id) ? cur.filter((x) => x !== u.id) : [...cur, u.id];
  await supabase.from("messages").update({ starred_by: next }).eq("id", m.id);
}

export function subscribeMessages(chatId: string, onChange: (m: MessageRow, event: string) => void): RealtimeChannel {
  return supabase
    .channel(`msgs:${chatId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
      (payload) => onChange((payload.new ?? payload.old) as MessageRow, payload.eventType),
    )
    .subscribe();
}

export function subscribeInbox(onChange: () => void): RealtimeChannel {
  return supabase
    .channel("inbox")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_members" }, onChange)
    .subscribe();
}

/** Lightweight typing indicator over a broadcast channel. */
export function typingChannel(chatId: string, onTyping: (userId: string) => void): RealtimeChannel {
  const ch = supabase.channel(`typing:${chatId}`, { config: { broadcast: { self: false } } });
  ch.on("broadcast", { event: "typing" }, ({ payload }) => onTyping(payload.userId)).subscribe();
  return ch;
}

/* ------------------------------ storage ----------------------------- */

const signedCache = new Map<string, { url: string; exp: number }>();

/** Uploads to a private bucket, returns `bucket/path` reference. */
export async function uploadMedia(bucket: "chat-media" | "stories" | "avatars", file: Blob, ext: string) {
  const u = await currentUser();
  if (!u) return null;
  const path = `${u.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return null;
  return `${bucket}/${path}`;
}

/** Resolves a `bucket/path` reference into a signed URL (cached ~50 min). */
export async function resolveMedia(ref: string | null): Promise<string | null> {
  if (!ref) return null;
  if (/^(https?:|data:|blob:)/.test(ref)) return ref;
  const hit = signedCache.get(ref);
  if (hit && hit.exp > Date.now()) return hit.url;
  const [bucket, ...rest] = ref.split("/");
  const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 3600);
  if (!data?.signedUrl) return null;
  signedCache.set(ref, { url: data.signedUrl, exp: Date.now() + 50 * 60_000 });
  return data.signedUrl;
}

/* ------------------------------ stories ----------------------------- */

export async function listStories(): Promise<StoryRow[]> {
  const { data } = await supabase
    .from("stories")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []) as StoryRow[];
}

export async function createStory(input: {
  mediaUrl: string | null;
  mediaType: string | null;
  caption?: string | null;
  overlays?: unknown;
  background?: string | null;
}) {
  const u = await currentUser();
  if (!u) return null;
  const { data } = await supabase
    .from("stories")
    .insert({
      user_id: u.id,
      media_url: input.mediaUrl,
      media_type: input.mediaType,
      caption: input.caption ?? null,
      overlays: (input.overlays ?? []) as never,
      background: input.background ?? null,
    })
    .select()
    .single();
  return data as StoryRow | null;
}

export async function markStoryViewed(storyId: string) {
  await supabase.rpc("mark_story_viewed", { _story: storyId });
}

export async function reactToStory(story: StoryRow, emoji: string) {
  const u = await currentUser();
  if (!u) return;
  const next = [...(story.reactions ?? []).filter((r) => r.user !== u.id), { user: u.id, emoji }];
  await supabase.from("stories").update({ reactions: next as never }).eq("id", story.id);
}

export async function deleteStory(id: string) {
  await supabase.from("stories").delete().eq("id", id);
}

/* ------------------------------- calls ------------------------------ */

export interface CallRow {
  id: string;
  chat_id: string | null;
  caller_id: string;
  callee_id: string;
  kind: string;
  status: string;
  offer: unknown;
  answer: unknown;
  caller_ice: unknown[];
  callee_ice: unknown[];
  created_at: string;
  ended_at: string | null;
}

export async function createCall(chatId: string, calleeId: string, kind: "audio" | "video") {
  const u = await currentUser();
  if (!u) return null;
  const { data } = await supabase
    .from("calls")
    .insert({ chat_id: chatId, caller_id: u.id, callee_id: calleeId, kind, status: "ringing" })
    .select()
    .single();
  return data as CallRow | null;
}

export async function patchCall(id: string, patch: Partial<CallRow>) {
  await supabase.from("calls").update(patch as never).eq("id", id);
}

export function subscribeCall(id: string, cb: (c: CallRow) => void): RealtimeChannel {
  return supabase
    .channel(`call:${id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${id}` },
      (p) => cb(p.new as CallRow),
    )
    .subscribe();
}

export function subscribeIncomingCalls(userId: string, cb: (c: CallRow) => void): RealtimeChannel {
  return supabase
    .channel("incoming-calls")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` },
      (p) => cb(p.new as CallRow),
    )
    .subscribe();
}

/* ------------------------------ helpers ----------------------------- */

export function displayNameOf(p: CloudProfile | null, nickname?: string | null) {
  return nickname || p?.nickname || p?.display_name || (p?.username ? `@${p.username}` : "Unknown");
}

export function previewOfMessage(m: MessageRow | null | undefined): string {
  if (!m) return "";
  if (m.deleted_for_all) return "🚫 Message deleted";
  switch (m.attachment_type) {
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "audio": return "🎤 Voice message";
    case "sticker": return `${(m.body ?? "").split("|")[0]} Sticker`;
    case "gif": return "🎞️ GIF";
    case "file": return `📎 ${m.attachment_name ?? "File"}`;
    default: return m.body ?? "";
  }
}
