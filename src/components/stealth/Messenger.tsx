import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatMessage,
  Contact,
  Story,
  archiveOldLogs,
  cacheRepo,
  contactsRepo,
  fetchUnifiedTimeline,
  generateReply,
  logsRepo,
  pruneExpiredStories,
  uid,
} from "@/lib/stealth/storage";
import { EmojiPicker } from "./EmojiPicker";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeId, applyTheme, getStoredTheme } from "@/lib/stealth/themes";

interface Props {
  onClose: () => void;
  onPanic: () => void;
}

type View = "list" | "chat" | "story" | "profile";

export function Messenger({ onClose, onPanic }: Props) {
  const [contacts, setContacts] = useState<Contact[]>(() => contactsRepo.list());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [stories, setStories] = useState<Story[]>([]);
  const [viewStory, setViewStory] = useState<Story | null>(null);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);

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
      if (x.sender_id === "them" && x.status !== "read") {
        m.set(x.contact_id, (m.get(x.contact_id) ?? 0) + 1);
      }
    });
    return m;
  }, [allMessages]);

  const sortedContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.bio ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const at = lastByContact.get(a.id)?.created_at ?? 0;
        const bt = lastByContact.get(b.id)?.created_at ?? 0;
        return bt - at;
      });
  }, [contacts, lastByContact, search]);

  const refreshMessages = () => setAllMessages(logsRepo.list());

  const openChat = (id: string) => {
    // mark unread as read
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
    <div className="h-dvh w-full bg-[#0b141a] text-white flex overflow-hidden">
      {view === "list" && (
        <ContactsView
          contacts={sortedContacts}
          stories={stories}
          search={search}
          setSearch={setSearch}
          lastByContact={lastByContact}
          unreadByContact={unreadByContact}
          onOpen={openChat}
          onProfile={(id) => { setActiveId(id); setView("profile"); }}
          onClose={onClose}
          onStoryClick={(s) => setViewStory(s)}
          onAddStory={(s) => {
            const next = [...cacheRepo.list(), s];
            cacheRepo.save(next);
            setStories(next);
          }}
        />
      )}
      {view === "chat" && active && (
        <ChatView
          contact={active}
          onBack={() => { setView("list"); refreshMessages(); }}
          onProfile={() => setView("profile")}
          onPanic={onPanic}
          onChanged={refreshMessages}
        />
      )}
      {view === "profile" && active && (
        <ProfileView contact={active} onBack={() => setView(activeId ? "chat" : "list")} onPin={() => {
          const next = contacts.map((c) => c.id === active.id ? { ...c, pinned: !c.pinned } : c);
          contactsRepo.save(next); setContacts(next);
        }} onMute={() => {
          const next = contacts.map((c) => c.id === active.id ? { ...c, muted: !c.muted } : c);
          contactsRepo.save(next); setContacts(next);
        }} />
      )}
      {viewStory && <StoryViewer story={viewStory} contact={contacts.find((c) => c.id === viewStory.contact_id)} onClose={() => setViewStory(null)} />}
    </div>
  );
}

/* ============================ CONTACTS LIST ============================ */
function ContactsView({
  contacts, stories, search, setSearch, lastByContact, unreadByContact,
  onOpen, onProfile, onClose, onStoryClick, onAddStory,
}: {
  contacts: Contact[];
  stories: Story[];
  search: string;
  setSearch: (s: string) => void;
  lastByContact: Map<string, ChatMessage>;
  unreadByContact: Map<string, number>;
  onOpen: (id: string) => void;
  onProfile: (id: string) => void;
  onClose: () => void;
  onStoryClick: (s: Story) => void;
  onAddStory: (s: Story) => void;
}) {
  const storyInput = useRef<HTMLInputElement>(null);
  const onPickStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await fileToDataUrl(f);
    onAddStory({
      id: uid(), contact_id: "me",
      media_type: f.type.startsWith("video") ? "video" : "image",
      media_url: url, created_at: Date.now(), expires_at: Date.now() + 24 * 3600_000,
    });
    e.target.value = "";
  };

  return (
    <div className="flex flex-col w-full bg-[#111b21]">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">Chats</h1>
        <div className="flex items-center gap-1">
          <IconBtn label="Search"><SearchIcon /></IconBtn>
          <IconBtn label="Camera"><CamIcon /></IconBtn>
          <button onClick={onClose} className="ml-1 text-[12px] text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded-md hover:bg-white/5">
            Lock
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Ask Meta AI or Search"
            className="w-full bg-[#202c33] rounded-full pl-10 pr-4 py-2 text-sm placeholder:text-[#8696a0] outline-none focus:ring-1 ring-emerald-500/40"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]"><SearchIcon size={16} /></span>
        </div>
      </div>

      {/* Stories */}
      <div className="px-3 py-3 flex gap-3 overflow-x-auto border-b border-white/5 scrollbar-none">
        <button onClick={() => storyInput.current?.click()} className="flex flex-col items-center gap-1 shrink-0">
          <div className="size-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center text-white text-2xl shadow-lg shadow-emerald-500/20">+</div>
          <span className="text-[10px] text-[#8696a0]">Your story</span>
        </button>
        {stories.map((s) => (
          <button key={s.id} onClick={() => onStoryClick(s)} className="flex flex-col items-center gap-1 shrink-0">
            <div className="size-14 rounded-full p-[2px] bg-gradient-to-tr from-emerald-400 via-pink-500 to-orange-400">
              {s.media_type === "image"
                ? <img src={s.media_url} className="size-full rounded-full object-cover border-2 border-[#111b21]" alt="" />
                : <video src={s.media_url} className="size-full rounded-full object-cover border-2 border-[#111b21]" />}
            </div>
            <span className="text-[10px] text-[#8696a0]">{timeLeft(s.expires_at)}</span>
          </button>
        ))}
        <input ref={storyInput} type="file" accept="image/*,video/*" hidden onChange={onPickStory} />
      </div>

      {/* Contact list */}
      <ul className="flex-1 overflow-y-auto">
        {contacts.map((c) => {
          const last = lastByContact.get(c.id);
          const unread = unreadByContact.get(c.id) ?? 0;
          return (
            <li key={c.id} className="active:bg-white/5">
              <button onClick={() => onOpen(c.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition">
                <button
                  onClick={(e) => { e.stopPropagation(); onProfile(c.id); }}
                  className={`size-12 shrink-0 rounded-full bg-gradient-to-br ${c.color} grid place-items-center text-xl relative`}
                >
                  {c.avatar}
                  {c.online && <span className="absolute bottom-0 right-0 size-3 bg-emerald-400 rounded-full border-2 border-[#111b21]" />}
                </button>
                <div className="flex-1 min-w-0 border-b border-white/5 pb-3 -mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate text-[15px]">{c.name}</span>
                    <span className={`text-[11px] shrink-0 ${unread ? "text-emerald-400" : "text-[#8696a0]"}`}>
                      {last ? formatChatTime(last.created_at) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[13px] text-[#8696a0] truncate flex items-center gap-1">
                      {last?.sender_id === "me" && <Ticks status={last.status ?? "sent"} small />}
                      {previewOf(last) || (c.bio ?? "")}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {c.muted && <span className="text-[#8696a0]">🔕</span>}
                      {unread > 0 && (
                        <span className="bg-emerald-500 text-[#111b21] text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 grid place-items-center">{unread}</span>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {contacts.length === 0 && <li className="text-center text-sm text-[#8696a0] py-12">No conversations.</li>}
      </ul>
    </div>
  );
}

/* ============================ CHAT VIEW ============================ */
function ChatView({ contact, onBack, onProfile, onPanic, onChanged }: {
  contact: Contact;
  onBack: () => void;
  onProfile: () => void;
  onPanic: () => void;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [mediaView, setMediaView] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const replyTimer = useRef<number | null>(null);

  useEffect(() => {
    fetchUnifiedTimeline(contact.id).then(setMessages);
  }, [contact.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

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

    // simulated delivery + read
    setTimeout(() => persistAll(updateStatus(next, m.id, "delivered")), 600);
    setTimeout(() => persistAll(updateStatus(next, m.id, "read")), 1800);

    // simulated typing + reply
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setTimeout(() => setTyping(true), 1500);
    replyTimer.current = window.setTimeout(() => {
      setTyping(false);
      const r: ChatMessage = {
        id: uid(), contact_id: contact.id, sender_id: "them",
        message_type: "text", log_payload: generateReply(partial.message_type === "text" ? partial.log_payload : undefined),
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

  // group by day
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
    <div className="flex flex-col w-full h-full bg-chat">
      {/* Header */}
      <header className="bg-[#202c33] px-2 py-2 flex items-center gap-2 border-b border-black/30 shadow-sm">
        <button onClick={onBack} className="size-9 grid place-items-center rounded-full hover:bg-white/5">
          <BackIcon />
        </button>
        <button onClick={onProfile} className={`size-10 rounded-full bg-gradient-to-br ${contact.color} grid place-items-center text-lg relative shrink-0`}>
          {contact.avatar}
          {contact.online && <span className="absolute bottom-0 right-0 size-2.5 bg-emerald-400 rounded-full border-2 border-[#202c33]" />}
        </button>
        <button onClick={onProfile} className="flex-1 min-w-0 text-left">
          <div className="text-[15px] font-medium truncate">{contact.name}</div>
          <div className="text-[11px] text-[#8696a0] truncate">
            {typing ? <span className="text-emerald-400">typing…</span>
              : contact.online ? "online"
              : contact.last_seen ? `last seen ${relTime(contact.last_seen)}` : "offline"}
          </div>
        </button>
        <IconBtn label="Video call"><VideoIcon /></IconBtn>
        <IconBtn label="Voice call"><PhoneIcon /></IconBtn>
        <IconBtn label="More"><DotsIcon /></IconBtn>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1"
        style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><circle cx='1' cy='1' r='1' fill='%23ffffff08'/></svg>\")", backgroundColor: "#0b141a" }}
        onClick={() => setSelected(null)}
      >
        {grouped.length === 0 && (
          <div className="text-center mt-20 text-[#8696a0] text-sm">
            <div className="bg-[#1f2c33] inline-block px-4 py-2 rounded-lg">
              Messages are end-to-end encrypted 🔒
            </div>
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.day} className="space-y-1">
            <div className="flex justify-center my-3">
              <span className="text-[11px] bg-[#1d282f] text-[#8696a0] px-3 py-1 rounded-md shadow-sm">{g.day}</span>
            </div>
            {g.items.map((m) => (
              <Bubble
                key={m.id} m={m}
                replyTo={m.reply_to ? messages.find((x) => x.id === m.reply_to) : null}
                selected={selected?.id === m.id}
                onSelect={() => setSelected(selected?.id === m.id ? null : m)}
                onMediaOpen={() => setMediaView(m)}
              />
            ))}
          </div>
        ))}
        {typing && <TypingBubble contact={contact} />}
      </div>

      {/* Action bar for selected message */}
      {selected && (
        <div className="bg-[#202c33] border-t border-black/30 px-3 py-2 flex items-center gap-1">
          <button onClick={() => { setReply(selected); setSelected(null); }} className="px-3 py-1.5 text-sm rounded-md hover:bg-white/5">↩ Reply</button>
          {selected.message_type === "text" && <button onClick={() => copyMsg(selected)} className="px-3 py-1.5 text-sm rounded-md hover:bg-white/5">⧉ Copy</button>}
          <button onClick={() => { deleteMsg(selected.id); setSelected(null); }} className="px-3 py-1.5 text-sm rounded-md text-red-400 hover:bg-white/5">🗑 Delete</button>
          <button onClick={() => setSelected(null)} className="ml-auto px-3 py-1.5 text-sm rounded-md hover:bg-white/5">Cancel</button>
        </div>
      )}

      {/* Reply preview */}
      {reply && (
        <div className="bg-[#1f2c33] px-3 py-2 flex items-start gap-2 border-t border-black/30">
          <div className="w-1 bg-emerald-400 rounded-full self-stretch" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-emerald-400">{reply.sender_id === "me" ? "You" : contact.name}</div>
            <div className="text-[13px] text-[#aebac1] truncate">{previewOf(reply)}</div>
          </div>
          <button onClick={() => setReply(null)} className="text-[#8696a0] hover:text-white">✕</button>
        </div>
      )}

      {/* Emoji panel */}
      {emoji && (
        <div className="bg-[#202c33] border-t border-black/30 px-3 py-3 grid grid-cols-10 gap-1 max-h-40 overflow-y-auto">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setText((t) => t + e)} className="text-xl hover:bg-white/5 rounded">{e}</button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="bg-[#202c33] px-2 py-2 flex items-end gap-2">
        <div className="flex-1 bg-[#2a3942] rounded-3xl px-3 py-1.5 flex items-end gap-2 min-h-[42px]">
          <button onClick={() => setEmoji((v) => !v)} className="size-8 grid place-items-center text-[#8696a0] hover:text-white shrink-0">
            <EmojiIcon />
          </button>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Message"
            rows={1}
            className="flex-1 resize-none outline-none text-[15px] bg-transparent max-h-32 placeholder:text-[#8696a0] py-2"
          />
          <button onClick={() => fileRef.current?.click()} className="size-8 grid place-items-center text-[#8696a0] hover:text-white shrink-0 -rotate-45">
            <ClipIcon />
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onMedia} />
        </div>
        {text.trim()
          ? <button onClick={onSend} aria-label="Send" className="size-11 grid place-items-center bg-[#00a884] hover:bg-[#06cf9c] text-white rounded-full shrink-0 transition"><SendIcon /></button>
          : <button onClick={toggleRecord} aria-label="Voice" className={`size-11 grid place-items-center rounded-full shrink-0 text-white transition ${recording ? "bg-red-600 animate-pulse" : "bg-[#00a884] hover:bg-[#06cf9c]"}`}><MicIcon /></button>}
      </div>

      {mediaView && <MediaViewer m={mediaView} onClose={() => setMediaView(null)} />}
    </div>
  );
}

/* ============================ BUBBLE ============================ */
function Bubble({ m, replyTo, selected, onSelect, onMediaOpen }: {
  m: ChatMessage; replyTo?: ChatMessage | null; selected: boolean; onSelect: () => void; onMediaOpen: () => void;
}) {
  const mine = m.sender_id === "me";
  const pressTimer = useRef<number | null>(null);
  const startPress = () => { pressTimer.current = window.setTimeout(onSelect, 420); };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} px-1`}>
      <div
        onClick={(e) => { e.stopPropagation(); if (selected) onSelect(); }}
        onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
        onTouchStart={startPress} onTouchEnd={cancelPress}
        onContextMenu={(e) => { e.preventDefault(); onSelect(); }}
        className={`max-w-[80%] sm:max-w-[65%] rounded-lg px-1.5 py-1 shadow-md cursor-pointer transition ${
          mine ? "bg-[#005c4b] text-white rounded-tr-none" : "bg-[#202c33] text-white rounded-tl-none"
        } ${selected ? "ring-2 ring-emerald-400" : ""}`}
      >
        {replyTo && (
          <div className={`mb-1 mx-0.5 rounded-md px-2 py-1 border-l-4 ${mine ? "bg-[#025144] border-emerald-300" : "bg-[#1a242c] border-emerald-400"}`}>
            <div className="text-[11px] font-medium text-emerald-300">{replyTo.sender_id === "me" ? "You" : "Them"}</div>
            <div className="text-[12px] text-white/70 truncate max-w-[260px]">{previewOf(replyTo)}</div>
          </div>
        )}
        {m.message_type === "text" && (
          <p className="text-[14.5px] leading-snug whitespace-pre-wrap break-words px-1.5 pt-0.5">
            {m.log_payload}
            <span className="inline-block w-16" />
          </p>
        )}
        {m.message_type === "image" && (
          <img onClick={(e) => { e.stopPropagation(); onMediaOpen(); }} src={m.log_payload} alt="" className="rounded-md max-h-72 object-cover cursor-zoom-in" />
        )}
        {m.message_type === "video" && (
          <video src={m.log_payload} controls className="rounded-md max-h-72 max-w-full" />
        )}
        {m.message_type === "audio" && <AudioBubble url={m.log_payload} mine={mine} />}
        <div className="text-[10px] text-white/60 text-right -mt-3 mr-1 flex items-center justify-end gap-1 pr-1">
          {m.source === "archive" && <span title="From archive">📁</span>}
          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {mine && <Ticks status={m.status ?? "sent"} />}
        </div>
      </div>
    </div>
  );
}

function AudioBubble({ url, mine }: { url: string; mine: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1 min-w-[200px] ${mine ? "" : ""}`}>
      <audio src={url} controls className="h-9 max-w-[220px]" />
    </div>
  );
}

function TypingBubble({ contact }: { contact: Contact }) {
  return (
    <div className="flex justify-start px-1">
      <div className="bg-[#202c33] rounded-lg rounded-tl-none px-3 py-2.5 flex items-center gap-1 shadow">
        <span className="size-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="size-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="size-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
        <span className="sr-only">{contact.name} typing</span>
      </div>
    </div>
  );
}

/* ============================ PROFILE ============================ */
function ProfileView({ contact, onBack, onPin, onMute }: { contact: Contact; onBack: () => void; onPin: () => void; onMute: () => void }) {
  return (
    <div className="w-full flex flex-col bg-[#111b21]">
      <header className="bg-[#202c33] px-3 py-3 flex items-center gap-3 border-b border-black/30">
        <button onClick={onBack} className="size-9 grid place-items-center rounded-full hover:bg-white/5"><BackIcon /></button>
        <h2 className="text-[16px] font-medium">Contact info</h2>
      </header>
      <div className="flex flex-col items-center pt-8 pb-6 bg-[#111b21]">
        <div className={`size-32 rounded-full bg-gradient-to-br ${contact.color} grid place-items-center text-6xl shadow-xl`}>{contact.avatar}</div>
        <h3 className="mt-4 text-[22px] font-medium">{contact.name}</h3>
        <p className="text-[#8696a0] text-sm mt-1">{contact.online ? "online" : contact.last_seen ? `last seen ${relTime(contact.last_seen)}` : "offline"}</p>
      </div>
      <div className="bg-[#202c33] px-4 py-3 border-y border-black/30">
        <div className="text-[12px] text-emerald-400">About</div>
        <div className="text-[15px] mt-1">{contact.bio || "No bio"}</div>
      </div>
      <div className="bg-[#202c33] mt-2 divide-y divide-black/30">
        <button onClick={onMute} className="w-full flex justify-between items-center px-4 py-4 hover:bg-white/5">
          <span>Mute notifications</span><span>{contact.muted ? "🔕" : "🔔"}</span>
        </button>
        <button onClick={onPin} className="w-full flex justify-between items-center px-4 py-4 hover:bg-white/5">
          <span>Pin chat</span><span>{contact.pinned ? "📌" : "—"}</span>
        </button>
        <button className="w-full flex justify-between items-center px-4 py-4 hover:bg-white/5 text-red-400">
          <span>Block contact</span><span>🚫</span>
        </button>
      </div>
    </div>
  );
}

/* ============================ STORY VIEWER ============================ */
function StoryViewer({ story, contact, onClose }: { story: Story; contact?: Contact; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20"><div className="h-full bg-white animate-[storybar_6s_linear_forwards]" style={{ width: "100%" }} /></div>
      <div className="flex items-center gap-3 p-4 z-10">
        {contact && <div className={`size-9 rounded-full bg-gradient-to-br ${contact.color} grid place-items-center`}>{contact.avatar}</div>}
        <span className="text-white text-sm">{contact?.name ?? "You"}</span>
        <button onClick={onClose} className="ml-auto text-white">✕</button>
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
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl">✕</button>
      {m.message_type === "image"
        ? <img src={m.log_payload} className="max-h-full max-w-full" alt="" />
        : <video src={m.log_payload} controls autoPlay className="max-h-full max-w-full" />}
    </div>
  );
}

/* ============================ HELPERS / ICONS ============================ */
function Ticks({ status, small }: { status: ChatMessage["status"]; small?: boolean }) {
  const color = status === "read" ? "text-sky-400" : "text-white/60";
  const sz = small ? 12 : 14;
  if (status === "sent") {
    return <svg width={sz} height={sz} viewBox="0 0 16 16" className={color}><path d="M11.5 4.5L6 10 4 8" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>;
  }
  return (
    <svg width={sz + 4} height={sz} viewBox="0 0 20 16" className={color}>
      <path d="M11.5 4.5L6 10 4 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M15.5 4.5L10 10 8.5 8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return <button aria-label={label} className="size-9 grid place-items-center rounded-full text-[#aebac1] hover:bg-white/5">{children}</button>;
}
const SearchIcon = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
const CamIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
const BackIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
const VideoIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>;
const PhoneIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const DotsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>;
const SendIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>;
const MicIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" /></svg>;
const EmojiIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>;
const ClipIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;

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
  const d = new Date(ts);
  const now = new Date();
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
  return m.log_payload;
}
