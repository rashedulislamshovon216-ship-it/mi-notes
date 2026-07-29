import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bell, BellOff, Bookmark, Camera, Check, CheckCheck, Copy, Edit3,
  Forward, Lock, Mic, MoreVertical, Paperclip, Phone, Pin, Plus, Reply, Search,
  Send, Settings, Smile, Star, Trash2, Video, X, Users, Loader2, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CallRow, ChatSummary, CloudProfile, MessageRow, StoryRow,
  createCall, createStory, deleteMessage, deleteStory, displayNameOf, editMessage,
  listChats, listMessages, listStories, markStoryViewed, myProfile, patchCall,
  previewOfMessage, reactToStory, resolveMedia, sendMessage, setContactFlag,
  subscribeInbox, subscribeIncomingCalls, subscribeMessages, toggleReaction,
  toggleStar, touchPresence, typingChannel, uploadMedia,
} from "@/lib/stealth/cloud";
import { REACTIONS } from "@/lib/stealth/emojis";
import { EmojiPicker } from "./EmojiPicker";
import { SettingsPanel } from "./SettingsPanel";
import { CallModal, IncomingCall } from "./CallModal";
import { StoryEditor } from "./StoryEditor";
import { FindPeople } from "./FindPeople";
import { AuthGate } from "./AuthGate";
import { Avatar, CloudMedia } from "./Avatar";
import { ThemeId, applyTheme, getStoredTheme } from "@/lib/stealth/themes";

interface Props { onClose: () => void; onPanic: () => void; }
type View = "list" | "chat" | "profile";

const readKey = (chatId: string) => `qn.read.${chatId}`;

export function Messenger({ onClose, onPanic }: Props) {
  const [me, setMe] = useState<CloudProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [viewStory, setViewStory] = useState<StoryRow | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());
  const [call, setCall] = useState<CallRow | null>(null);
  const [incoming, setIncoming] = useState<CallRow | null>(null);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([listChats(), listStories()]);
    setChats(
      c.map((x) => {
        const lastRead = Number(localStorage.getItem(readKey(x.chatId)) ?? 0);
        const unread =
          x.last && x.last.sender_id !== me?.id && new Date(x.last.created_at).getTime() > lastRead ? 1 : 0;
        return { ...x, unread };
      }),
    );
    setStories(s);
  }, [me?.id]);

  const boot = useCallback(async () => {
    const p = await myProfile();
    setMe(p);
    setReady(true);
    if (p) { touchPresence(); }
  }, []);

  useEffect(() => { boot(); }, [boot]);
  useEffect(() => { if (me) refresh(); }, [me, refresh]);

  useEffect(() => {
    if (!me) return;
    const inbox = subscribeInbox(() => refresh());
    const calls = subscribeIncomingCalls(me.id, (c) => setIncoming(c));
    const presence = setInterval(touchPresence, 60_000);
    return () => {
      supabase.removeChannel(inbox);
      supabase.removeChannel(calls);
      clearInterval(presence);
    };
  }, [me, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => {
      const n = c.isSelf ? "saved messages" : displayNameOf(c.other, c.nickname).toLowerCase();
      return n.includes(q) || (c.other?.username ?? "").toLowerCase().includes(q);
    });
  }, [chats, search]);

  const active = chats.find((c) => c.chatId === activeId) ?? null;

  const openChat = async (chatId: string) => {
    localStorage.setItem(readKey(chatId), String(Date.now()));
    setActiveId(chatId);
    setView("chat");
    setChats((p) => p.map((c) => (c.chatId === chatId ? { ...c, unread: 0 } : c)));
    // A chat started from search isn't in the list yet — pull it in so the
    // thread renders instead of an empty (black) screen.
    if (!chats.some((c) => c.chatId === chatId)) await refresh();
  };


  const startCall = async (kind: "audio" | "video") => {
    if (!active?.other || active.isSelf) return;
    const c = await createCall(active.chatId, active.other.id, kind);
    if (c) setCall(c);
  };

  const postStory = async (dataUrl: string, mediaType: "image" | "video") => {
    const blob = await (await fetch(dataUrl)).blob();
    const ref = await uploadMedia("stories", blob, mediaType === "video" ? "webm" : "jpg");
    if (ref) await createStory({ mediaUrl: ref, mediaType });
    setStoryFile(null);
    refresh();
  };

  if (!ready) {
    return (
      <div className="h-dvh w-full aurora-bg grid place-items-center text-white">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!me) return <AuthGate onExit={onClose} onReady={() => boot()} />;

  return (
    <div className="h-dvh w-full aurora-bg text-white flex overflow-hidden select-none">
      {view === "list" && (
        <ContactsView
          me={me} chats={filtered} stories={stories} search={search} setSearch={setSearch}
          onOpen={openChat}
          onProfile={(id) => { setActiveId(id); setView("profile"); }}
          onClose={onClose}
          onSettings={() => setSettingsOpen(true)}
          onFind={() => setFindOpen(true)}
          onStoryClick={setViewStory}
          onPickStoryFile={setStoryFile}
        />
      )}
      {view === "chat" && active && (
        <ChatView
          key={active.chatId}
          me={me} chat={active}
          onBack={() => { setView("list"); refresh(); }}
          onProfile={() => setView("profile")}
          onPanic={onPanic}
          onSettings={() => setSettingsOpen(true)}
          onCall={startCall}
        />
      )}
      {view === "profile" && active && (
        <ProfileView
          chat={active}
          onBack={() => setView(activeId ? "chat" : "list")}
          onCall={startCall}
          onChanged={refresh}
        />
      )}

      {viewStory && (
        <StoryViewer
          story={viewStory} me={me}
          author={chats.find((c) => c.other?.id === viewStory.user_id)?.other ?? (viewStory.user_id === me.id ? me : null)}
          onClose={() => { setViewStory(null); refresh(); }}
        />
      )}
      {storyFile && <StoryEditor file={storyFile} onCancel={() => setStoryFile(null)} onPost={postStory} />}
      {findOpen && <FindPeople meId={me.id} onClose={() => setFindOpen(false)} onOpenChat={(id) => { refresh(); openChat(id); }} />}

      {incoming && !call && (
        <IncomingCall
          call={incoming}
          peer={chats.find((c) => c.other?.id === incoming.caller_id)?.other ?? null}
          onAccept={() => { setCall(incoming); setIncoming(null); }}
          onDecline={() => { patchCall(incoming.id, { status: "declined" }); setIncoming(null); }}
        />
      )}
      {call && (
        <CallModal
          call={call} me={me.id}
          peer={chats.find((c) => c.other?.id === (call.caller_id === me.id ? call.callee_id : call.caller_id))?.other ?? null}
          onClose={() => setCall(null)}
        />
      )}
      <SettingsPanel open={settingsOpen} onClose={() => { setSettingsOpen(false); boot(); }} theme={theme} onTheme={setTheme} />
    </div>
  );
}

/* ============================ CHAT LIST ============================ */
function ContactsView({
  me, chats, stories, search, setSearch, onOpen, onProfile, onClose, onSettings, onFind,
  onStoryClick, onPickStoryFile,
}: {
  me: CloudProfile; chats: ChatSummary[]; stories: StoryRow[];
  search: string; setSearch: (s: string) => void;
  onOpen: (id: string) => void; onProfile: (id: string) => void; onClose: () => void;
  onSettings: () => void; onFind: () => void;
  onStoryClick: (s: StoryRow) => void; onPickStoryFile: (f: File) => void;
}) {
  const storyInput = useRef<HTMLInputElement>(null);
  const mine = stories.filter((s) => s.user_id === me.id);
  const others = stories.filter((s) => s.user_id !== me.id);

  return (
    <div className="flex flex-col w-full relative">
      <header className="glass px-4 pt-5 pb-3 flex items-center justify-between sticky top-0 z-10">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold tracking-tight">Messages</h1>
          <p className="text-[11px] text-[var(--msg-muted)] flex items-center gap-1 truncate">
            <Lock className="size-3" /> @{me.username} · end-to-end
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Find people" onClick={onFind}><Plus className="size-5" /></IconBtn>
          <IconBtn label="Settings" onClick={onSettings}><Settings className="size-5" /></IconBtn>
          <button onClick={onClose} className="ml-1 text-[12px] text-red-300 hover:text-red-200 font-medium px-3 py-1.5 rounded-full glass-soft">Lock</button>
        </div>
      </header>

      <div className="px-3 py-3">
        <div className="relative">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…"
            className="w-full glass-soft rounded-full pl-10 pr-4 py-2.5 text-sm placeholder:text-[var(--msg-muted)] outline-none focus:ring-2 focus:ring-[var(--msg-accent)]/40" />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--msg-muted)] size-4" />
        </div>
      </div>

      <div className="px-3 pb-3 flex gap-3 overflow-x-auto border-b border-white/5 scrollbar-none">
        <button onClick={() => storyInput.current?.click()} className="flex flex-col items-center gap-1 shrink-0">
          <span className="size-14 rounded-full glass grid place-items-center text-2xl glow-accent">＋</span>
          <span className="text-[10px] text-[var(--msg-muted)]">Your story</span>
        </button>
        {[...mine, ...others].map((s) => (
          <StoryBubble key={s.id} story={s} onClick={() => onStoryClick(s)} />
        ))}
        <input ref={storyInput} type="file" accept="image/*,video/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickStoryFile(f); e.target.value = ""; }} />
      </div>

      <ul className="flex-1 overflow-y-auto pb-24">
        {chats.map((c) => (
          <li key={c.chatId} className="active:bg-white/5">
            <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition">
              <button onClick={() => onProfile(c.chatId)} className="shrink-0">
                {c.isSelf
                  ? <span className="size-12 rounded-full glass grid place-items-center"><Bookmark className="size-5" /></span>
                  : <Avatar profile={c.other} size={48} online={isOnline(c.other?.last_seen)} nickname={c.nickname} />}
              </button>
              <button onClick={() => onOpen(c.chatId)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{c.isSelf ? "Saved Messages" : displayNameOf(c.other, c.nickname)}</span>
                  {c.pinned && <Pin className="size-3 text-[var(--msg-muted)]" />}
                  <span className="ml-auto text-[11px] text-[var(--msg-muted)] shrink-0">
                    {c.last ? formatChatTime(new Date(c.last.created_at).getTime()) : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[13px] text-[var(--msg-muted)] truncate flex-1">
                    {previewOfMessage(c.last) || (c.other?.bio ?? "Say hi 👋")}
                  </span>
                  {c.muted && <BellOff className="size-3 text-[var(--msg-muted)]" />}
                  {c.unread > 0 && <span className="size-2.5 rounded-full bg-[var(--msg-accent)]" />}
                </div>
              </button>
            </div>
          </li>
        ))}
        {chats.length === 0 && (
          <li className="text-center text-sm text-[var(--msg-muted)] py-16 px-8">
            <Users className="size-8 mx-auto mb-3 opacity-40" />
            No conversations yet. Tap ＋ and search a friend’s @handle.
          </li>
        )}
      </ul>

      <button onClick={onFind}
        className="absolute right-5 bottom-6 size-14 rounded-full glass-strong glow-accent grid place-items-center active:scale-95 transition">
        <Plus className="size-6" />
      </button>
    </div>
  );
}

function StoryBubble({ story, onClick }: { story: StoryRow; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { resolveMedia(story.media_url).then(setUrl); }, [story.media_url]);
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 shrink-0">
      <span className="size-14 rounded-full p-[2px] bg-gradient-to-tr from-[var(--msg-accent)] via-pink-400 to-amber-400 block">
        {url ? (
          story.media_type === "image"
            ? <img src={url} className="size-full rounded-full object-cover border-2 border-[var(--msg-bg)]" alt="" />
            : <video src={url} className="size-full rounded-full object-cover border-2 border-[var(--msg-bg)]" />
        ) : <span className="size-full rounded-full bg-white/10 block" />}
      </span>
      <span className="text-[10px] text-[var(--msg-muted)]">{timeLeft(new Date(story.expires_at).getTime())}</span>
    </button>
  );
}

/* ============================ CHAT VIEW ============================ */
function ChatView({ me, chat, onBack, onProfile, onPanic, onSettings, onCall }: {
  me: CloudProfile; chat: ChatSummary; onBack: () => void; onProfile: () => void;
  onPanic: () => void; onSettings: () => void; onCall: (kind: "audio" | "video") => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [reply, setReply] = useState<MessageRow | null>(null);
  const [selected, setSelected] = useState<MessageRow | null>(null);
  const [reactingTo, setReactingTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [mediaView, setMediaView] = useState<MessageRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const typingCh = useRef<ReturnType<typeof typingChannel> | null>(null);
  const typingTimer = useRef<number | null>(null);

  const load = useCallback(async () => setMessages(await listMessages(chat.chatId)), [chat.chatId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = subscribeMessages(chat.chatId, () => load());
    typingCh.current = typingChannel(chat.chatId, (uid) => {
      if (uid === me.id) return;
      setPeerTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setPeerTyping(false), 2500);
    });
    return () => {
      supabase.removeChannel(ch);
      if (typingCh.current) supabase.removeChannel(typingCh.current);
    };
  }, [chat.chatId, load, me.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, peerTyping]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const visible = useMemo(
    () => messages.filter((m) => !(m.deleted_for ?? []).includes(me.id)),
    [messages, me.id],
  );

  const push = async (payload: Parameters<typeof sendMessage>[0]) => {
    const optimistic: MessageRow = {
      id: `tmp-${Math.random()}`, chat_id: chat.chatId, sender_id: me.id,
      body: payload.body ?? null, attachment_url: payload.attachmentUrl ?? null,
      attachment_type: payload.attachmentType ?? null, attachment_name: payload.attachmentName ?? null,
      reply_to: payload.replyTo ?? null, reactions: {}, starred_by: [], edited_at: null,
      deleted_for_all: false, deleted_for: [], created_at: new Date().toISOString(), pending: true,
    };
    setMessages((p) => [...p, optimistic]);
    setReply(null);
    const saved = await sendMessage(payload);
    setMessages((p) => (saved ? p.map((m) => (m.id === optimistic.id ? saved : m)) : p.filter((m) => m.id !== optimistic.id)));
  };

  const onSend = async () => {
    const v = text.trim();
    if (!v) return;
    if (v === "//") { setText(""); onPanic(); return; }
    if (editing) {
      await editMessage(editing.id, v);
      setEditing(null); setText(""); load();
      return;
    }
    setText("");
    await push({ chatId: chat.chatId, body: v, replyTo: reply?.id ?? null });
  };

  const onType = (v: string) => {
    setText(v);
    typingCh.current?.send({ type: "broadcast", event: "typing", payload: { userId: me.id } });
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    const ext = f.name.split(".").pop() || "bin";
    const ref = await uploadMedia("chat-media", f, ext);
    setUploading(false);
    if (!ref) return;
    const type = f.type.startsWith("image") ? "image" : f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "file";
    await push({ chatId: chat.chatId, attachmentUrl: ref, attachmentType: type, attachmentName: f.name, replyTo: reply?.id ?? null });
  };

  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: pickAudioMime() });
      chunks.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        setRecording(false); setRecSecs(0); setUploading(true);
        const ref = await uploadMedia("chat-media", blob, "webm");
        setUploading(false);
        if (ref) await push({ chatId: chat.chatId, attachmentUrl: ref, attachmentType: "audio", attachmentName: "voice.webm" });
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch { alert("Microphone access denied."); }
  };

  const grouped = useMemo(() => {
    const out: { day: string; items: MessageRow[] }[] = [];
    visible.forEach((m) => {
      const day = dayLabel(new Date(m.created_at).getTime());
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    });
    return out;
  }, [visible]);

  const title = chat.isSelf ? "Saved Messages" : displayNameOf(chat.other, chat.nickname);

  return (
    <div className="flex flex-col w-full h-full relative">
      <header className="glass px-1.5 py-2 flex items-center gap-1.5 sticky top-0 z-10">
        <button onClick={onBack} className="size-10 grid place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="size-5" /></button>
        <button onClick={onProfile} className="shrink-0">
          {chat.isSelf
            ? <span className="size-10 rounded-full glass grid place-items-center"><Bookmark className="size-4" /></span>
            : <Avatar profile={chat.other} size={40} online={isOnline(chat.other?.last_seen)} nickname={chat.nickname} />}
        </button>
        <button onClick={onProfile} className="flex-1 min-w-0 text-left px-1">
          <div className="text-[15px] font-medium truncate">{title}</div>
          <div className="text-[11px] text-[var(--msg-muted)] truncate">
            {chat.isSelf ? "notes to self"
              : peerTyping ? <span className="text-[var(--msg-accent)]">typing…</span>
              : isOnline(chat.other?.last_seen) ? "online"
              : chat.other?.last_seen ? `last seen ${relTime(new Date(chat.other.last_seen).getTime())}` : "offline"}
          </div>
        </button>
        {!chat.isSelf && <>
          <IconBtn label="Video call" onClick={() => onCall("video")}><Video className="size-5" /></IconBtn>
          <IconBtn label="Voice call" onClick={() => onCall("audio")}><Phone className="size-5" /></IconBtn>
        </>}
        <IconBtn label="More" onClick={onSettings}><MoreVertical className="size-5" /></IconBtn>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1" onClick={() => setSelected(null)}>
        {grouped.length === 0 && (
          <div className="text-center mt-20 text-[var(--msg-muted)] text-sm">
            <span className="glass inline-flex items-center gap-2 px-4 py-2 rounded-full">
              <Lock className="size-3" /> Messages are private to you two
            </span>
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.day} className="space-y-1">
            <div className="flex justify-center my-3">
              <span className="text-[11px] glass px-3 py-1 rounded-full text-[var(--msg-muted)]">{g.day}</span>
            </div>
            {g.items.map((m) => (
              <Bubble key={m.id} m={m} me={me.id}
                replyTo={m.reply_to ? visible.find((x) => x.id === m.reply_to) : null}
                selected={selected?.id === m.id}
                onSelect={() => setSelected(selected?.id === m.id ? null : m)}
                onReact={() => setReactingTo(m)}
                onSwipeReply={() => setReply(m)}
                onMediaOpen={() => setMediaView(m)} />
            ))}
          </div>
        ))}
        {peerTyping && <TypingBubble />}
      </div>

      {reactingTo && (
        <div className="absolute inset-x-0 bottom-32 z-20 flex justify-center px-4">
          <div className="glass-strong rounded-full px-2 py-1.5 flex items-center gap-0.5 shadow-2xl">
            {REACTIONS.map((r) => (
              <button key={r} onClick={async () => { await toggleReaction(reactingTo, r); setReactingTo(null); setSelected(null); load(); }}
                className="size-10 grid place-items-center text-2xl rounded-full hover:bg-white/10 active:scale-90 transition">{r}</button>
            ))}
            <button onClick={() => setReactingTo(null)} className="size-9 grid place-items-center rounded-full hover:bg-white/10 ml-1"><X className="size-4" /></button>
          </div>
        </div>
      )}

      {selected && (
        <div className="glass px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <ActionBtn onClick={() => setReactingTo(selected)}><Smile className="size-4" />React</ActionBtn>
          <ActionBtn onClick={() => { setReply(selected); setSelected(null); }}><Reply className="size-4" />Reply</ActionBtn>
          <ActionBtn onClick={async () => { await push({ chatId: chat.chatId, body: selected.body, attachmentUrl: selected.attachment_url, attachmentType: selected.attachment_type, attachmentName: selected.attachment_name }); setSelected(null); }}>
            <Forward className="size-4" />Forward
          </ActionBtn>
          <ActionBtn onClick={async () => { await toggleStar(selected); setSelected(null); load(); }}>
            <Star className={`size-4 ${(selected.starred_by ?? []).includes(me.id) ? "fill-current text-amber-300" : ""}`} />
            {(selected.starred_by ?? []).includes(me.id) ? "Unstar" : "Star"}
          </ActionBtn>
          {selected.body && <ActionBtn onClick={() => { navigator.clipboard?.writeText(selected.body ?? ""); setSelected(null); }}><Copy className="size-4" />Copy</ActionBtn>}
          {selected.sender_id === me.id && selected.body && !selected.attachment_url && (
            <ActionBtn onClick={() => { setEditing(selected); setText(selected.body ?? ""); setSelected(null); }}><Edit3 className="size-4" />Edit</ActionBtn>
          )}
          <ActionBtn danger onClick={async () => { await deleteMessage(selected.id, selected.sender_id === me.id); setSelected(null); load(); }}>
            <Trash2 className="size-4" />Delete
          </ActionBtn>
          <button onClick={() => setSelected(null)} className="ml-auto px-3 py-1.5 text-xs rounded-full hover:bg-white/5">Cancel</button>
        </div>
      )}

      {(reply || editing) && (
        <div className="glass px-3 py-2 flex items-start gap-2">
          <span className="w-1 bg-[var(--msg-accent)] rounded-full self-stretch" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-[var(--msg-accent)]">
              {editing ? "Editing message" : reply!.sender_id === me.id ? "Replying to yourself" : `Replying to ${title}`}
            </div>
            <div className="text-[13px] text-white/70 truncate">{previewOfMessage(editing ?? reply)}</div>
          </div>
          <button onClick={() => { setReply(null); setEditing(null); setText(""); }} className="text-white/60 hover:text-white"><X className="size-4" /></button>
        </div>
      )}

      {emoji && (
        <EmojiPicker
          onPickEmoji={(e) => setText((t) => t + e)}
          onPickSticker={(s) => { push({ chatId: chat.chatId, body: `${s.emoji}|${s.caption}`, attachmentType: "sticker" }); setEmoji(false); }}
          onPickGif={(url) => { push({ chatId: chat.chatId, attachmentUrl: url, attachmentType: "gif" }); setEmoji(false); }}
        />
      )}

      <div className="glass px-2 py-2 flex items-end gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {recording ? (
          <div className="flex-1 glass-soft rounded-3xl px-4 h-11 flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm tabular-nums">{String(Math.floor(recSecs / 60)).padStart(2, "0")}:{String(recSecs % 60).padStart(2, "0")}</span>
            <span className="text-xs text-white/50">recording…</span>
          </div>
        ) : (
          <div className="flex-1 glass-soft rounded-3xl px-1.5 py-1 flex items-end gap-0.5 min-h-[44px]">
            <button onClick={() => setEmoji((v) => !v)} className="size-9 grid place-items-center text-white/60 hover:text-white shrink-0"><Smile className="size-5" /></button>
            <textarea value={text} onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder={editing ? "Edit message…" : "Message"} rows={1}
              className="flex-1 resize-none outline-none text-[15px] bg-transparent max-h-32 placeholder:text-white/40 py-2 select-text" />
            {uploading && <Loader2 className="size-4 animate-spin text-white/60 mb-3" />}
            <button onClick={() => fileRef.current?.click()} className="size-9 grid place-items-center text-white/60 hover:text-white shrink-0"><Paperclip className="size-5" /></button>
            <button onClick={() => camRef.current?.click()} className="size-9 grid place-items-center text-white/60 hover:text-white shrink-0"><Camera className="size-5" /></button>
            <input ref={fileRef} type="file" hidden onChange={onFiles} />
            <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={onFiles} />
          </div>
        )}
        {text.trim() && !recording
          ? <button onClick={onSend} aria-label="Send" className="size-11 grid place-items-center bg-[var(--msg-accent)] text-[var(--msg-bg)] rounded-full shrink-0 transition active:scale-95 glow-accent"><Send className="size-5" /></button>
          : <button onClick={toggleRecord} aria-label="Voice" className={`size-11 grid place-items-center rounded-full shrink-0 transition active:scale-95 ${recording ? "bg-red-500 text-white animate-pulse" : "bg-[var(--msg-accent)] text-[var(--msg-bg)] glow-accent"}`}><Mic className="size-5" /></button>}
      </div>

      {mediaView && <MediaViewer m={mediaView} onClose={() => setMediaView(null)} />}
    </div>
  );
}

/* ============================ BUBBLE ============================ */
function Bubble({ m, me, replyTo, selected, onSelect, onReact, onSwipeReply, onMediaOpen }: {
  m: MessageRow; me: string; replyTo?: MessageRow | null; selected: boolean;
  onSelect: () => void; onReact: () => void; onSwipeReply: () => void; onMediaOpen: () => void;
}) {
  const mine = m.sender_id === me;
  const pressTimer = useRef<number | null>(null);
  const startX = useRef(0);
  const [dx, setDx] = useState(0);

  const startPress = () => { pressTimer.current = window.setTimeout(onSelect, 380); };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const entries = Object.entries(m.reactions ?? {}).filter(([, u]) => (u as string[]).length);
  const starred = (m.starred_by ?? []).includes(me);

  if (m.deleted_for_all) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"} px-1`}>
        <div className="glass-soft rounded-2xl px-3 py-2 text-[13px] italic text-white/50">Message deleted</div>
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} px-1`}
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; startPress(); }}
      onTouchMove={(e) => {
        const d = e.touches[0].clientX - startX.current;
        if (Math.abs(d) > 8) cancelPress();
        setDx(Math.max(-10, Math.min(70, d)));
      }}
      onTouchEnd={() => { cancelPress(); if (dx > 48) onSwipeReply(); setDx(0); }}
    >
      <div className="max-w-[82%] sm:max-w-[65%] transition-transform" style={{ transform: `translateX(${dx}px)` }}>
        {dx > 20 && <Reply className="size-4 absolute -ml-7 mt-4 text-[var(--msg-accent)]" />}
        <div
          onClick={(e) => { e.stopPropagation(); if (selected) onSelect(); }}
          onDoubleClick={(e) => { e.stopPropagation(); onReact(); }}
          onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
          onContextMenu={(e) => { e.preventDefault(); onSelect(); }}
          className={`relative rounded-2xl px-1.5 py-1 cursor-pointer transition ${
            mine ? "glass-bubble-mine rounded-tr-md" : "glass-bubble-them rounded-tl-md"
          } ${selected ? "ring-2 ring-[var(--msg-accent)]" : ""} ${starred ? "ring-1 ring-amber-300/50" : ""} ${m.pending ? "opacity-60" : ""}`}
        >
          {replyTo && (
            <div className={`mb-1 mx-0.5 rounded-md px-2 py-1 border-l-4 ${mine ? "bg-black/10 border-black/40" : "bg-white/5 border-[var(--msg-accent)]"}`}>
              <div className={`text-[11px] font-medium ${mine ? "text-black/70" : "text-[var(--msg-accent)]"}`}>
                {replyTo.sender_id === me ? "You" : "Them"}
              </div>
              <div className={`text-[12px] truncate max-w-[240px] ${mine ? "text-black/60" : "text-white/70"}`}>{previewOfMessage(replyTo)}</div>
            </div>
          )}

          {m.attachment_type === "image" && (
            <CloudMedia refPath={m.attachment_url} kind="image" onClick={(e) => { e.stopPropagation(); onMediaOpen(); }}
              className="rounded-xl max-h-72 object-cover cursor-zoom-in" />
          )}
          {m.attachment_type === "video" && <CloudMedia refPath={m.attachment_url} kind="video" className="rounded-xl max-h-72 max-w-full" />}
          {m.attachment_type === "audio" && <CloudMedia refPath={m.attachment_url} kind="audio" className="h-9 max-w-[220px] my-1" />}
          {m.attachment_type === "gif" && (
            <img src={m.attachment_url ?? ""} alt="gif" onClick={(e) => { e.stopPropagation(); onMediaOpen(); }}
              className="rounded-xl max-h-60 object-cover cursor-zoom-in" />
          )}
          {m.attachment_type === "file" && (
            <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMediaOpen(); }}
              className="flex items-center gap-2 px-2 py-2 min-w-[180px]">
              <FileText className={`size-6 ${mine ? "text-black/70" : "text-white/70"}`} />
              <span className={`text-[13px] truncate ${mine ? "text-black" : "text-white"}`}>{m.attachment_name}</span>
            </a>
          )}
          {m.attachment_type === "sticker" && (() => {
            const [emo, cap] = (m.body ?? "").split("|");
            return (
              <div className="flex flex-col items-center px-3 py-2 min-w-[120px]">
                <span className="text-[72px] leading-none float-slow drop-shadow-2xl">{emo}</span>
                {cap && <span className={`text-[11px] mt-1 ${mine ? "text-black/60" : "text-white/70"}`}>{cap}</span>}
              </div>
            );
          })()}
          {!m.attachment_type && m.body && (
            <p className={`text-[14.5px] leading-snug whitespace-pre-wrap break-words px-1.5 pt-0.5 ${mine ? "text-[var(--msg-bg)]" : "text-white"}`}>
              {m.body}<span className="inline-block w-16" />
            </p>
          )}

          <div className={`text-[10px] text-right mr-1 flex items-center justify-end gap-1 pr-1 ${!m.attachment_type && m.body ? "-mt-3" : "mt-0.5"} ${mine ? "text-black/60" : "text-white/60"}`}>
            {starred && <Star className="size-2.5 fill-amber-300 text-amber-300" />}
            {m.edited_at && <span>edited</span>}
            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {mine && (m.pending ? <Check className="size-3 opacity-50" /> : <CheckCheck className="size-3.5 text-sky-500" />)}
          </div>
        </div>

        {entries.length > 0 && (
          <div className={`flex gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
            {entries.map(([e, users]) => (
              <span key={e} className="glass-soft text-[12px] rounded-full px-2 py-0.5 leading-none">
                {e}{(users as string[]).length > 1 ? ` ${(users as string[]).length}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start px-1">
      <div className="glass-bubble-them rounded-2xl rounded-tl-md px-3 py-2.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}

/* ============================ PROFILE ============================ */
function ProfileView({ chat, onBack, onCall, onChanged }: {
  chat: ChatSummary; onBack: () => void; onCall: (kind: "audio" | "video") => void; onChanged: () => void;
}) {
  const [nickname, setNickname] = useState(chat.nickname ?? "");
  const p = chat.other;

  const flag = async (patch: Parameters<typeof setContactFlag>[1]) => {
    if (!p) return;
    await setContactFlag(p.id, patch);
    onChanged();
  };

  return (
    <div className="w-full h-full overflow-y-auto pb-10">
      <header className="glass px-2 py-2 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="size-10 grid place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="size-5" /></button>
        <h2 className="text-[15px] font-medium">Contact info</h2>
      </header>

      <div className="flex flex-col items-center gap-3 py-8">
        {chat.isSelf ? <span className="size-24 rounded-full glass grid place-items-center"><Bookmark className="size-8" /></span> : <Avatar profile={p} size={96} nickname={chat.nickname} />}
        <div className="text-center">
          <h3 className="text-xl font-semibold">{chat.isSelf ? "Saved Messages" : displayNameOf(p, chat.nickname)}</h3>
          {p?.username && !chat.isSelf && <p className="text-sm text-[var(--msg-muted)]">@{p.username}</p>}
        </div>
        {!chat.isSelf && (
          <div className="flex gap-6 mt-2">
            <ProfileAction label="Voice" onClick={() => onCall("audio")}><Phone className="size-5" /></ProfileAction>
            <ProfileAction label="Video" onClick={() => onCall("video")}><Video className="size-5" /></ProfileAction>
            <ProfileAction label={chat.muted ? "Unmute" : "Mute"} onClick={() => flag({ muted: !chat.muted })}>
              {chat.muted ? <Bell className="size-5" /> : <BellOff className="size-5" />}
            </ProfileAction>
            <ProfileAction label={chat.pinned ? "Unpin" : "Pin"} onClick={() => flag({ pinned: !chat.pinned })}><Pin className="size-5" /></ProfileAction>
          </div>
        )}
      </div>

      {!chat.isSelf && (
        <div className="glass px-4 py-3 mx-3 rounded-2xl space-y-2">
          <div className="text-[12px] text-[var(--msg-accent)]">Nickname (only you see this)</div>
          <div className="flex gap-2">
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={displayNameOf(p)}
              className="flex-1 glass-soft rounded-full px-4 py-2 text-sm outline-none select-text" />
            <button onClick={() => flag({ nickname: nickname.trim() || null })}
              className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold">Save</button>
          </div>
        </div>
      )}

      <div className="glass px-4 py-3 mx-3 mt-3 rounded-2xl">
        <div className="text-[12px] text-[var(--msg-accent)]">About</div>
        <div className="text-[15px] mt-1">{chat.isSelf ? "Everything you send here stays private." : p?.bio || "No bio yet"}</div>
      </div>
    </div>
  );
}

function ProfileAction({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span className="size-12 rounded-full glass grid place-items-center">{children}</span>
      <span className="text-[11px] text-[var(--msg-muted)]">{label}</span>
    </button>
  );
}

/* ============================ STORY VIEWER ============================ */
function StoryViewer({ story, me, author, onClose }: {
  story: StoryRow; me: CloudProfile; author: CloudProfile | null; onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [reacted, setReacted] = useState<string | null>(null);
  const mine = story.user_id === me.id;

  useEffect(() => { resolveMedia(story.media_url).then(setUrl); }, [story.media_url]);
  useEffect(() => { markStoryViewed(story.id); }, [story.id]);
  useEffect(() => { const t = setTimeout(onClose, 8000); return () => clearTimeout(t); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="absolute top-0 inset-x-0 h-1 bg-white/20">
        <div className="h-full bg-white animate-[storybar_8s_linear_forwards]" />
      </div>
      <div className="flex items-center gap-3 p-4 z-10">
        <Avatar profile={author} size={36} />
        <span className="text-white text-sm">{mine ? "Your story" : displayNameOf(author)}</span>
        <span className="text-white/50 text-xs">{relTime(new Date(story.created_at).getTime())}</span>
        {mine && (
          <button onClick={async () => { await deleteStory(story.id); onClose(); }} className="ml-auto text-red-300"><Trash2 className="size-5" /></button>
        )}
        <button onClick={onClose} className={mine ? "text-white" : "ml-auto text-white"}><X className="size-5" /></button>
      </div>

      <div className="flex-1 grid place-items-center">
        {url && (story.media_type === "image"
          ? <img src={url} className="max-h-full max-w-full" alt="" />
          : <video src={url} autoPlay controls className="max-h-full max-w-full" />)}
      </div>

      <div className="p-4 pb-8 flex items-center justify-center gap-2">
        {mine ? (
          <span className="glass rounded-full px-4 py-2 text-xs text-white/70">
            👁 {(story.viewers ?? []).length} views · {(story.reactions ?? []).length} reactions
          </span>
        ) : (
          REACTIONS.slice(0, 6).map((r) => (
            <button key={r} onClick={async () => { await reactToStory(story, r); setReacted(r); }}
              className={`size-11 grid place-items-center text-2xl rounded-full glass active:scale-90 transition ${reacted === r ? "ring-2 ring-white" : ""}`}>{r}</button>
          ))
        )}
      </div>
      <style>{`@keyframes storybar { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

/* ============================ MEDIA VIEWER ============================ */
function MediaViewer({ m, onClose }: { m: MessageRow; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { resolveMedia(m.attachment_url).then(setUrl); }, [m.attachment_url]);
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/95 z-[60] grid place-items-center p-4">
      <button onClick={onClose} className="absolute top-4 right-4 text-white"><X className="size-6" /></button>
      {url && (m.attachment_type === "video"
        ? <video src={url} controls autoPlay className="max-h-full max-w-full" />
        : m.attachment_type === "file"
          ? <a href={url} download={m.attachment_name ?? "file"} className="glass px-5 py-3 rounded-2xl text-white text-sm">Download {m.attachment_name}</a>
          : <img src={url} className="max-h-full max-w-full" alt="" />)}
    </div>
  );
}

/* ============================ HELPERS ============================ */
function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return <button aria-label={label} onClick={onClick} className="size-10 grid place-items-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition">{children}</button>;
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full hover:bg-white/10 flex items-center gap-1.5 shrink-0 ${danger ? "text-red-400" : "text-white"}`}>
      {children}
    </button>
  );
}

function pickAudioMime() {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const o of opts) if (MediaRecorder.isTypeSupported(o)) return o;
  return "";
}
function isOnline(lastSeen?: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60_000;
}
function timeLeft(expires: number) {
  const h = Math.max(0, Math.round((expires - Date.now()) / 3_600_000));
  return `${h}h left`;
}
function formatChatTime(ts: number) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diff = (now.getTime() - ts) / 86400_000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString();
}
function dayLabel(ts: number) {
  const d = new Date(ts), now = new Date();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
function relTime(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}
