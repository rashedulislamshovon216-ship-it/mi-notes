import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Camera, Lock, Mic, Paperclip, Phone, Search, Send, Settings, Smile,
  Video, MoreVertical, X, Pin, BellOff, Bell, Star, Copy, Reply, Trash2, Forward,
  Edit3, Plus, CheckCheck, Check,
} from "lucide-react";
import {
  ChatMessage, Contact, Story,
  archiveOldLogs, cacheRepo, contactsRepo, fetchUnifiedTimeline,
  generateReply, logsRepo, pruneExpiredStories, uid,
} from "@/lib/stealth/storage";
import { REACTIONS } from "@/lib/stealth/emojis";
import { EmojiPicker } from "./EmojiPicker";
import { SettingsPanel } from "./SettingsPanel";
import { CallModal } from "./CallModal";
import { StoryEditor } from "./StoryEditor";
import { FindPeople } from "./FindPeople";
import { ThemeId, applyTheme, getStoredTheme } from "@/lib/stealth/themes";

interface Props { onClose: () => void; onPanic: () => void; }
type View = "list" | "chat" | "profile";

export function Messenger({ onClose, onPanic }: Props) {
  const [contacts, setContacts] = useState<Contact[]>(() => contactsRepo.list());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [stories, setStories] = useState<Story[]>([]);
  const [viewStory, setViewStory] = useState<Story | null>(null);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());
  const [call, setCall] = useState<{ contact: Contact; mode: "voice" | "video" } | null>(null);

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    archiveOldLogs();
    setAllMessages(logsRepo.list());
    setStories(pruneExpiredStories());
    const t = setInterval(() => setStories(pruneExpiredStories()), 60_000);
    return () => clearInterval(t);
  }, []);

  const lastByContact = useMemo(() => {
    const m = new Map<string, ChatMessage>();
    [...allMessages].sort((a, b) => a.created_at - b.created_at).forEach((x) => m.set(x.contact_id, x));
    return m;
  }, [allMessages]);

  const unreadByContact = useMemo(() => {
    const m = new Map<string, number>();
    allMessages.forEach((x) => {
      if (x.sender_id === "them" && x.status !== "read") m.set(x.contact_id, (m.get(x.contact_id) ?? 0) + 1);
    });
    return m;
  }, [allMessages]);

  const sortedContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.bio ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (lastByContact.get(b.id)?.created_at ?? 0) - (lastByContact.get(a.id)?.created_at ?? 0);
      });
  }, [contacts, lastByContact, search]);

  const refreshMessages = () => setAllMessages(logsRepo.list());

  const openChat = (id: string) => {
    const next = logsRepo.list().map((m) =>
      m.contact_id === id && m.sender_id === "them" ? { ...m, status: "read" as const } : m,
    );
    logsRepo.save(next);
    setAllMessages(next);
    setActiveId(id);
    setView("chat");
  };

  const active = contacts.find((c) => c.id === activeId) ?? null;

  return (
    <div className="h-dvh w-full aurora-bg text-white flex overflow-hidden">
      {view === "list" && (
        <ContactsView
          contacts={sortedContacts} stories={stories} search={search} setSearch={setSearch}
          lastByContact={lastByContact} unreadByContact={unreadByContact}
          onOpen={openChat}
          onProfile={(id) => { setActiveId(id); setView("profile"); }}
          onClose={onClose}
          onSettings={() => setSettingsOpen(true)}
          onFind={() => setFindOpen(true)}
          onStoryClick={(s) => setViewStory(s)}
          onPickStoryFile={(f) => setStoryFile(f)}
        />
      )}
      {view === "chat" && active && (
        <ChatView
          contact={active}
          onBack={() => { setView("list"); refreshMessages(); }}
          onProfile={() => setView("profile")}
          onPanic={onPanic}
          onChanged={refreshMessages}
          onSettings={() => setSettingsOpen(true)}
          onCall={(mode) => setCall({ contact: active, mode })}
        />
      )}
      {view === "profile" && active && (
        <ProfileView contact={active}
          onBack={() => setView(activeId ? "chat" : "list")}
          onCall={(mode) => setCall({ contact: active, mode })}
          onPin={() => {
            const next = contacts.map((c) => c.id === active.id ? { ...c, pinned: !c.pinned } : c);
            contactsRepo.save(next); setContacts(next);
          }}
          onMute={() => {
            const next = contacts.map((c) => c.id === active.id ? { ...c, muted: !c.muted } : c);
            contactsRepo.save(next); setContacts(next);
          }} />
      )}
      {viewStory && <StoryViewer story={viewStory} contact={contacts.find((c) => c.id === viewStory.contact_id)} onClose={() => setViewStory(null)} />}
      {storyFile && <StoryEditor file={storyFile} onCancel={() => setStoryFile(null)} onPost={(url, t) => {
        const next = [...cacheRepo.list(), { id: uid(), contact_id: "me", media_type: t, media_url: url, created_at: Date.now(), expires_at: Date.now() + 24 * 3600_000 }];
        cacheRepo.save(next); setStories(next); setStoryFile(null);
      }} />}
      {findOpen && <FindPeople existing={contacts} onClose={() => setFindOpen(false)} onAdded={(c) => setContacts(contactsRepo.list())} />}
      {call && <CallModal contact={call.contact} mode={call.mode} onClose={() => setCall(null)} />}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onTheme={setTheme} />
    </div>
  );
}

/* ============================ CONTACTS LIST ============================ */
function ContactsView({
  contacts, stories, search, setSearch, lastByContact, unreadByContact,
  onOpen, onProfile, onClose, onSettings, onFind, onStoryClick, onPickStoryFile,
}: {
  contacts: Contact[]; stories: Story[]; search: string; setSearch: (s: string) => void;
  lastByContact: Map<string, ChatMessage>; unreadByContact: Map<string, number>;
  onOpen: (id: string) => void; onProfile: (id: string) => void; onClose: () => void;
  onSettings: () => void; onFind: () => void;
  onStoryClick: (s: Story) => void; onPickStoryFile: (f: File) => void;
}) {
  const storyInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col w-full aurora-bg">
      <header className="glass px-4 pt-5 pb-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-white">Messages</h1>
          <p className="text-[11px] text-[var(--msg-muted)] flex items-center gap-1"><Lock className="size-3" /> end-to-end encrypted</p>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Find people" onClick={onFind}><Plus className="size-5" /></IconBtn>
          <IconBtn label="Settings" onClick={onSettings}><Settings className="size-5" /></IconBtn>
          <button onClick={onClose} className="ml-1 text-[12px] text-red-300 hover:text-red-200 font-medium px-3 py-1.5 rounded-full glass-soft">Lock</button>
        </div>
      </header>

      <div className="px-3 py-3">
        <div className="relative">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full glass-soft rounded-full pl-10 pr-4 py-2.5 text-sm placeholder:text-[var(--msg-muted)] outline-none focus:ring-2 focus:ring-[var(--msg-accent)]/40"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--msg-muted)] size-4" />
        </div>
      </div>

      <div className="px-3 py-3 flex gap-3 overflow-x-auto border-b border-white/5 scrollbar-none">
        <button onClick={() => storyInput.current?.click()} className="flex flex-col items-center gap-1 shrink-0">
          <div className="size-14 rounded-full glass grid place-items-center text-white text-2xl glow-accent">＋</div>
          <span className="text-[10px] text-[var(--msg-muted)]">Your story</span>
        </button>
        {stories.map((s) => (
          <button key={s.id} onClick={() => onStoryClick(s)} className="flex flex-col items-center gap-1 shrink-0">
            <div className="size-14 rounded-full p-[2px] bg-gradient-to-tr from-[var(--msg-accent)] via-pink-400 to-amber-400">
              {s.media_type === "image"
                ? <img src={s.media_url} className="size-full rounded-full object-cover border-2 border-[var(--msg-bg)]" alt="" />
                : <video src={s.media_url} className="size-full rounded-full object-cover border-2 border-[var(--msg-bg)]" />}
            </div>
            <span className="text-[10px] text-[var(--msg-muted)]">{timeLeft(s.expires_at)}</span>
          </button>
        ))}
        <input ref={storyInput} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickStoryFile(f); e.target.value = ""; }} />
      </div>

      <ul className="flex-1 overflow-y-auto">
        {contacts.map((c) => {
          const last = lastByContact.get(c.id);
          const unread = unreadByContact.get(c.id) ?? 0;
          return (
            <li key={c.id} className="active:bg-white/5">
              <button onClick={() => onOpen(c.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition">
                <button onClick={(e) => { e.stopPropagation(); onProfile(c.id); }}
                  className={`size-12 shrink-0 rounded-full bg-gradient-to-br ${c.color} grid place-items-center text-xl relative shadow-md`}>
                  {c.avatar}
                  {c.online && <span className="absolute bottom-0 right-0 size-3 bg-emerald-400 rounded-full border-2 border-[var(--msg-bg)]" />}
                </button>
                <div className="flex-1 min-w-0 border-b border-white/5 pb-3 -mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate text-[15px] flex items-center gap-1">
                      {c.pinned && <Pin className="size-3 text-[var(--msg-accent)] shrink-0" />}
                      {c.name}
                    </span>
                    <span className={`text-[11px] shrink-0 ${unread ? "text-[var(--msg-accent)]" : "text-[var(--msg-muted)]"}`}>
                      {last ? formatChatTime(last.created_at) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[13px] text-[var(--msg-muted)] truncate flex items-center gap-1">
                      {last?.sender_id === "me" && <Ticks status={last.status ?? "sent"} small />}
                      {previewOf(last) || (c.bio ?? "")}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {c.muted && <BellOff className="size-3 text-[var(--msg-muted)]" />}
                      {unread > 0 && (
                        <span className="bg-[var(--msg-accent)] text-[var(--msg-bg)] text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 grid place-items-center">{unread}</span>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {contacts.length === 0 && <li className="text-center text-sm text-[var(--msg-muted)] py-12">No conversations.</li>}
      </ul>

      {/* FAB */}
      <button onClick={onFind}
        className="absolute right-5 bottom-6 size-14 rounded-full glass-strong glow-accent grid place-items-center text-white active:scale-95 transition">
        <Plus className="size-6" />
      </button>
    </div>
  );
}

/* ============================ CHAT VIEW ============================ */
function ChatView({ contact, onBack, onProfile, onPanic, onChanged, onSettings, onCall }: {
  contact: Contact; onBack: () => void; onProfile: () => void; onPanic: () => void;
  onChanged: () => void; onSettings: () => void; onCall: (mode: "voice" | "video") => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [reactingTo, setReactingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [mediaView, setMediaView] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const replyTimer = useRef<number | null>(null);

  useEffect(() => { fetchUnifiedTimeline(contact.id).then(setMessages); }, [contact.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, typing]);

  const persistAll = (next: ChatMessage[]) => {
    const all = logsRepo.list().filter((m) => m.contact_id !== contact.id);
    const live = next.filter((m) => m.source !== "archive").map(({ source: _s, ...m }) => m);
    logsRepo.save([...all, ...live]);
    setMessages(next);
    onChanged();
  };

  const send = (partial: Omit<ChatMessage, "id" | "created_at" | "sender_id" | "contact_id" | "status">) => {
    const m: ChatMessage = {
      id: uid(), contact_id: contact.id, sender_id: "me",
      created_at: Date.now(), status: "sent", source: "live",
      reply_to: reply?.id ?? null, ...partial,
    };
    const next = [...messages, m];
    persistAll(next);
    setReply(null);

    setTimeout(() => persistAll(updateStatus(next, m.id, "delivered")), 600);
    setTimeout(() => persistAll(updateStatus(next, m.id, "read")), 1800);

    if (replyTimer.current) clearTimeout(replyTimer.current);
    setTimeout(() => setTyping(true), 1500);
    replyTimer.current = window.setTimeout(() => {
      setTyping(false);
      const r: ChatMessage = {
        id: uid(), contact_id: contact.id, sender_id: "them",
        message_type: "text",
        log_payload: generateReply(partial.message_type === "text" ? partial.log_payload : undefined),
        created_at: Date.now(), status: "read", source: "live",
      };
      persistAll([...next.map((x) => x.id === m.id ? { ...x, status: "read" as const } : x), r]);
    }, 2800 + Math.random() * 1500);
  };

  const updateStatus = (arr: ChatMessage[], id: string, status: ChatMessage["status"]) =>
    arr.map((x) => x.id === id ? { ...x, status } : x);

  const onSend = () => {
    const v = text.trim();
    if (!v) return;
    if (v === "//") { setText(""); onPanic(); return; }
    if (editing) {
      persistAll(messages.map((m) => m.id === editing.id ? { ...m, log_payload: v, edited_at: Date.now() } : m));
      setEditing(null); setText("");
      return;
    }
    setText("");
    send({ message_type: "text", log_payload: v });
  };

  const onMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await fileToDataUrl(f);
    send({ message_type: f.type.startsWith("video") ? "video" : "image", log_payload: url });
    e.target.value = "";
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
        const url = await fileToDataUrl(blob);
        send({ message_type: "audio", log_payload: url });
        setRecording(false);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch { alert("Microphone access denied."); }
  };

  const deleteMsg = (id: string) => persistAll(messages.filter((m) => m.id !== id));
  const copyMsg = (m: ChatMessage) => { navigator.clipboard?.writeText(m.log_payload); setSelected(null); };
  const toggleStar = (m: ChatMessage) => persistAll(messages.map((x) => x.id === m.id ? { ...x, starred: !x.starred } : x));
  const startEdit = (m: ChatMessage) => { setEditing(m); setText(m.log_payload); setSelected(null); };
  const addReaction = (m: ChatMessage, emoji: string) => {
    persistAll(messages.map((x) => {
      if (x.id !== m.id) return x;
      const cur = x.reactions ?? {};
      const has = cur[emoji] === "me";
      const next = { ...cur };
      if (has) delete next[emoji]; else next[emoji] = "me";
      return { ...x, reactions: next };
    }));
    setReactingTo(null); setSelected(null);
  };
  const forwardMsg = (m: ChatMessage) => {
    // simple forward: re-send to same chat as me (placeholder for share sheet)
    send({ message_type: m.message_type, log_payload: m.log_payload });
    setSelected(null);
  };

  const grouped = useMemo(() => {
    const out: { day: string; items: ChatMessage[] }[] = [];
    messages.forEach((m) => {
      const day = dayLabel(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    });
    return out;
  }, [messages]);

  return (
    <div className="flex flex-col w-full h-full aurora-bg">
      {/* Header */}
      <header className="glass px-2 py-2 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="size-10 grid place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="size-5" /></button>
        <button onClick={onProfile} className={`size-10 rounded-full bg-gradient-to-br ${contact.color} grid place-items-center text-lg relative shrink-0 shadow-md`}>
          {contact.avatar}
          {contact.online && <span className="absolute bottom-0 right-0 size-2.5 bg-emerald-400 rounded-full border-2 border-[var(--msg-bg)]" />}
        </button>
        <button onClick={onProfile} className="flex-1 min-w-0 text-left">
          <div className="text-[15px] font-medium truncate">{contact.name}</div>
          <div className="text-[11px] text-[var(--msg-muted)] truncate">
            {typing ? <span className="text-[var(--msg-accent)]">typing…</span>
              : contact.online ? "online"
              : contact.last_seen ? `last seen ${relTime(contact.last_seen)}` : "offline"}
          </div>
        </button>
        <IconBtn label="Video call" onClick={() => onCall("video")}><Video className="size-5" /></IconBtn>
        <IconBtn label="Voice call" onClick={() => onCall("voice")}><Phone className="size-5" /></IconBtn>
        <IconBtn label="Settings" onClick={onSettings}><MoreVertical className="size-5" /></IconBtn>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1" onClick={() => setSelected(null)}>
        {grouped.length === 0 && (
          <div className="text-center mt-20 text-[var(--msg-muted)] text-sm">
            <div className="glass inline-flex items-center gap-2 px-4 py-2 rounded-full">
              <Lock className="size-3" /> Messages are end-to-end encrypted
            </div>
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.day} className="space-y-1">
            <div className="flex justify-center my-3">
              <span className="text-[11px] glass px-3 py-1 rounded-full text-[var(--msg-muted)]">{g.day}</span>
            </div>
            {g.items.map((m) => (
              <Bubble key={m.id} m={m}
                replyTo={m.reply_to ? messages.find((x) => x.id === m.reply_to) : null}
                selected={selected?.id === m.id}
                onSelect={() => setSelected(selected?.id === m.id ? null : m)}
                onReact={() => setReactingTo(m)}
                onMediaOpen={() => setMediaView(m)} />
            ))}
          </div>
        ))}
        {typing && <TypingBubble />}
      </div>

      {/* Reaction palette */}
      {reactingTo && (
        <div className="absolute inset-x-0 bottom-32 z-20 flex justify-center pointer-events-none">
          <div className="glass-strong rounded-full px-3 py-2 flex items-center gap-1 pointer-events-auto animate-in fade-in zoom-in-95">
            {REACTIONS.map((r) => (
              <button key={r} onClick={() => addReaction(reactingTo, r)}
                className="size-10 grid place-items-center text-2xl rounded-full hover:bg-white/10 active:scale-90 transition">{r}</button>
            ))}
            <button onClick={() => setReactingTo(null)} className="size-9 grid place-items-center rounded-full hover:bg-white/10 ml-1"><X className="size-4" /></button>
          </div>
        </div>
      )}

      {/* Action bar */}
      {selected && (
        <div className="glass px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <ActionBtn onClick={() => { setReactingTo(selected); }}><Smile className="size-4" />React</ActionBtn>
          <ActionBtn onClick={() => { setReply(selected); setSelected(null); }}><Reply className="size-4" />Reply</ActionBtn>
          <ActionBtn onClick={() => forwardMsg(selected)}><Forward className="size-4" />Forward</ActionBtn>
          <ActionBtn onClick={() => toggleStar(selected)}><Star className={`size-4 ${selected.starred ? "fill-current text-amber-300" : ""}`} />{selected.starred ? "Unstar" : "Star"}</ActionBtn>
          {selected.message_type === "text" && <ActionBtn onClick={() => copyMsg(selected)}><Copy className="size-4" />Copy</ActionBtn>}
          {selected.sender_id === "me" && selected.message_type === "text" && (
            <ActionBtn onClick={() => startEdit(selected)}><Edit3 className="size-4" />Edit</ActionBtn>
          )}
          <ActionBtn danger onClick={() => { deleteMsg(selected.id); setSelected(null); }}><Trash2 className="size-4" />Delete</ActionBtn>
          <button onClick={() => setSelected(null)} className="ml-auto px-3 py-1.5 text-xs rounded-full hover:bg-white/5">Cancel</button>
        </div>
      )}

      {/* Reply / edit preview */}
      {(reply || editing) && (
        <div className="glass px-3 py-2 flex items-start gap-2">
          <div className="w-1 bg-[var(--msg-accent)] rounded-full self-stretch" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-[var(--msg-accent)]">
              {editing ? "Editing message" : (reply!.sender_id === "me" ? "Replying to you" : `Replying to ${contact.name}`)}
            </div>
            <div className="text-[13px] text-white/70 truncate">{previewOf(editing ?? reply)}</div>
          </div>
          <button onClick={() => { setReply(null); setEditing(null); setText(""); }} className="text-white/60 hover:text-white"><X className="size-4" /></button>
        </div>
      )}

      {/* Emoji panel */}
      {emoji && (
        <EmojiPicker
          onPickEmoji={(e) => setText((t) => t + e)}
          onPickSticker={(s) => { send({ message_type: "sticker", log_payload: `${s.emoji}|${s.caption}` }); setEmoji(false); }}
          onPickGif={(url) => { send({ message_type: "gif", log_payload: url }); setEmoji(false); }}
        />
      )}

      {/* Composer */}
      <div className="glass px-2 py-2 flex items-end gap-2">
        <div className="flex-1 glass-soft rounded-3xl px-2 py-1 flex items-end gap-1 min-h-[44px]">
          <button onClick={() => setEmoji((v) => !v)} className="size-9 grid place-items-center text-white/60 hover:text-white shrink-0">
            <Smile className="size-5" />
          </button>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={editing ? "Edit message…" : "Message"}
            rows={1}
            className="flex-1 resize-none outline-none text-[15px] bg-transparent max-h-32 placeholder:text-white/40 py-2"
          />
          <button onClick={() => fileRef.current?.click()} className="size-9 grid place-items-center text-white/60 hover:text-white shrink-0">
            <Paperclip className="size-5" />
          </button>
          <button className="size-9 grid place-items-center text-white/60 hover:text-white shrink-0">
            <Camera className="size-5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onMedia} />
        </div>
        {text.trim()
          ? <button onClick={onSend} aria-label="Send" className="size-11 grid place-items-center bg-[var(--msg-accent)] text-[var(--msg-bg)] rounded-full shrink-0 transition active:scale-95 glow-accent"><Send className="size-5" /></button>
          : <button onClick={toggleRecord} aria-label="Voice" className={`size-11 grid place-items-center rounded-full shrink-0 transition active:scale-95 ${recording ? "bg-red-500 text-white animate-pulse" : "bg-[var(--msg-accent)] text-[var(--msg-bg)] glow-accent"}`}><Mic className="size-5" /></button>}
      </div>

      {mediaView && <MediaViewer m={mediaView} onClose={() => setMediaView(null)} />}
    </div>
  );
}

/* ============================ BUBBLE ============================ */
function Bubble({ m, replyTo, selected, onSelect, onReact, onMediaOpen }: {
  m: ChatMessage; replyTo?: ChatMessage | null; selected: boolean;
  onSelect: () => void; onReact: () => void; onMediaOpen: () => void;
}) {
  const mine = m.sender_id === "me";
  const pressTimer = useRef<number | null>(null);
  const startPress = () => { pressTimer.current = window.setTimeout(onSelect, 380); };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };
  const reactions = m.reactions ?? {};
  const reactionEntries = Object.entries(reactions);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} px-1`}>
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div
          onClick={(e) => { e.stopPropagation(); if (selected) onSelect(); }}
          onDoubleClick={(e) => { e.stopPropagation(); onReact(); }}
          onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
          onTouchStart={startPress} onTouchEnd={cancelPress}
          onContextMenu={(e) => { e.preventDefault(); onSelect(); }}
          className={`relative rounded-2xl px-1.5 py-1 cursor-pointer transition ${
            mine ? "glass-bubble-mine rounded-tr-md" : "glass-bubble-them rounded-tl-md"
          } ${selected ? "ring-2 ring-[var(--msg-accent)]" : ""} ${m.starred ? "ring-1 ring-amber-300/50" : ""}`}
        >
          {replyTo && (
            <div className={`mb-1 mx-0.5 rounded-md px-2 py-1 border-l-4 ${mine ? "bg-black/10 border-black/40" : "bg-white/5 border-[var(--msg-accent)]"}`}>
              <div className={`text-[11px] font-medium ${mine ? "text-black/70" : "text-[var(--msg-accent)]"}`}>
                {replyTo.sender_id === "me" ? "You" : "Them"}
              </div>
              <div className={`text-[12px] truncate max-w-[260px] ${mine ? "text-black/60" : "text-white/70"}`}>{previewOf(replyTo)}</div>
            </div>
          )}
          {m.message_type === "text" && (
            <p className={`text-[14.5px] leading-snug whitespace-pre-wrap break-words px-1.5 pt-0.5 ${mine ? "text-[var(--msg-bg)]" : "text-white"}`}>
              {m.log_payload}
              <span className="inline-block w-16" />
            </p>
          )}
          {m.message_type === "image" && (
            <img onClick={(e) => { e.stopPropagation(); onMediaOpen(); }} src={m.log_payload} alt="" className="rounded-xl max-h-72 object-cover cursor-zoom-in" />
          )}
          {m.message_type === "video" && (
            <video src={m.log_payload} controls className="rounded-xl max-h-72 max-w-full" />
          )}
          {m.message_type === "audio" && <AudioBubble url={m.log_payload} />}
          {m.message_type === "sticker" && (() => {
            const [emo, cap] = m.log_payload.split("|");
            return (
              <div className="flex flex-col items-center px-3 py-2 min-w-[120px]">
                <span className="text-[72px] leading-none float-slow drop-shadow-2xl">{emo}</span>
                {cap && <span className={`text-[11px] mt-1 ${mine ? "text-black/60" : "text-white/70"}`}>{cap}</span>}
              </div>
            );
          })()}
          {m.message_type === "gif" && (
            <img onClick={(e) => { e.stopPropagation(); onMediaOpen(); }} src={m.log_payload} alt="gif" className="rounded-xl max-h-60 object-cover cursor-zoom-in" />
          )}
          <div className={`text-[10px] text-right -mt-3 mr-1 flex items-center justify-end gap-1 pr-1 ${mine ? "text-black/60" : "text-white/60"}`}>
            {m.starred && <Star className="size-2.5 fill-amber-300 text-amber-300" />}
            {m.edited_at && <span>edited</span>}
            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {mine && <Ticks status={m.status ?? "sent"} dark />}
          </div>
        </div>
        {reactionEntries.length > 0 && (
          <div className={`flex gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
            {reactionEntries.map(([e]) => (
              <span key={e} className="glass-soft text-[12px] rounded-full px-2 py-0.5 leading-none">{e}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AudioBubble({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 min-w-[200px]">
      <audio src={url} controls className="h-9 max-w-[220px]" />
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start px-1">
      <div className="glass-bubble-them rounded-2xl rounded-tl-md px-3 py-2.5 flex items-center gap-1">
        <span className="size-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="size-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="size-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
      </div>
    </div>
  );
}

/* ============================ PROFILE ============================ */
function ProfileView({ contact, onBack, onPin, onMute, onCall }: {
  contact: Contact; onBack: () => void; onPin: () => void; onMute: () => void;
  onCall: (mode: "voice" | "video") => void;
}) {
  return (
    <div className="w-full flex flex-col aurora-bg">
      <header className="glass px-3 py-3 flex items-center gap-3">
        <button onClick={onBack} className="size-10 grid place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="size-5" /></button>
        <h2 className="text-[16px] font-medium">Contact info</h2>
      </header>
      <div className="flex flex-col items-center pt-8 pb-6">
        <div className={`size-32 rounded-full bg-gradient-to-br ${contact.color} grid place-items-center text-6xl shadow-2xl ring-4 ring-white/10`}>{contact.avatar}</div>
        <h3 className="mt-4 text-[22px] font-medium">{contact.name}</h3>
        <p className="text-[var(--msg-muted)] text-sm mt-1">{contact.online ? "online" : contact.last_seen ? `last seen ${relTime(contact.last_seen)}` : "offline"}</p>
        <div className="flex items-center gap-3 mt-5">
          <ProfileAction label="Voice" onClick={() => onCall("voice")}><Phone className="size-5" /></ProfileAction>
          <ProfileAction label="Video" onClick={() => onCall("video")}><Video className="size-5" /></ProfileAction>
          <ProfileAction label={contact.muted ? "Unmute" : "Mute"} onClick={onMute}>{contact.muted ? <Bell className="size-5" /> : <BellOff className="size-5" />}</ProfileAction>
          <ProfileAction label={contact.pinned ? "Unpin" : "Pin"} onClick={onPin}><Pin className="size-5" /></ProfileAction>
        </div>
      </div>
      <div className="glass px-4 py-3 mx-3 rounded-2xl">
        <div className="text-[12px] text-[var(--msg-accent)]">About</div>
        <div className="text-[15px] mt-1">{contact.bio || "No bio"}</div>
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
function StoryViewer({ story, contact, onClose }: { story: Story; contact?: Contact; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20"><div className="h-full bg-white animate-[storybar_6s_linear_forwards]" style={{ width: "100%" }} /></div>
      <div className="flex items-center gap-3 p-4 z-10">
        {contact && <div className={`size-9 rounded-full bg-gradient-to-br ${contact.color} grid place-items-center`}>{contact.avatar}</div>}
        <span className="text-white text-sm">{contact?.name ?? "You"}</span>
        <button onClick={onClose} className="ml-auto text-white"><X className="size-5" /></button>
      </div>
      <div className="flex-1 grid place-items-center" onClick={onClose}>
        {story.media_type === "image"
          ? <img src={story.media_url} className="max-h-full max-w-full" alt="" />
          : <video src={story.media_url} autoPlay controls className="max-h-full max-w-full" />}
      </div>
      <style>{`@keyframes storybar { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

/* ============================ MEDIA VIEWER ============================ */
function MediaViewer({ m, onClose }: { m: ChatMessage; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/95 z-50 grid place-items-center p-4">
      <button onClick={onClose} className="absolute top-4 right-4 text-white"><X className="size-6" /></button>
      {m.message_type === "image" || m.message_type === "gif"
        ? <img src={m.log_payload} className="max-h-full max-w-full" alt="" />
        : <video src={m.log_payload} controls autoPlay className="max-h-full max-w-full" />}
    </div>
  );
}

/* ============================ HELPERS ============================ */
function Ticks({ status, small, dark }: { status: ChatMessage["status"]; small?: boolean; dark?: boolean }) {
  const color = status === "read" ? "text-sky-500" : dark ? "text-black/50" : "text-white/60";
  if (status === "sent") return <Check className={`${color} ${small ? "size-3" : "size-3.5"}`} />;
  return <CheckCheck className={`${color} ${small ? "size-3" : "size-3.5"}`} />;
}

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

function fileToDataUrl(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
function pickAudioMime() {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const o of opts) if (MediaRecorder.isTypeSupported(o)) return o;
  return "";
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
function previewOf(m?: ChatMessage | null) {
  if (!m) return "";
  if (m.message_type === "image") return "📷 Photo";
  if (m.message_type === "video") return "🎬 Video";
  if (m.message_type === "audio") return "🎤 Voice message";
  if (m.message_type === "sticker") return `${m.log_payload.split("|")[0]} Sticker`;
  if (m.message_type === "gif") return "🎞️ GIF";
  return m.log_payload;
}
