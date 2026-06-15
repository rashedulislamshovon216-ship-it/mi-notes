import { useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  Story,
  cacheRepo,
  fetchUnifiedTimeline,
  logsRepo,
  pruneExpiredStories,
  uid,
} from "@/lib/stealth/storage";

interface Props {
  onClose: () => void;
  onPanic: () => void;
}

export function Messenger({ onClose, onPanic }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLInputElement>(null);

  // initial unified fetch (Supabase live + Sheets archive)
  useEffect(() => {
    fetchUnifiedTimeline().then(setMessages);
    setStories(pruneExpiredStories());
    const t = setInterval(() => setStories(pruneExpiredStories()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Simulated realtime subscription — re-pull on storage changes.
  useEffect(() => {
    const h = () => fetchUnifiedTimeline().then(setMessages);
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const persist = (next: ChatMessage[]) => {
    const live = next.filter((m) => m.source !== "archive");
    logsRepo.save(live.map(({ source: _s, ...m }) => m));
    setMessages(next);
  };

  const send = (msg: Omit<ChatMessage, "id" | "created_at" | "sender_id">) => {
    const m: ChatMessage = {
      id: uid(),
      created_at: Date.now(),
      sender_id: "me",
      source: "live",
      ...msg,
    };
    persist([...messages, m]);
    // simulate a reply for demo realism
    setTimeout(() => {
      const r: ChatMessage = {
        id: uid(),
        created_at: Date.now(),
        sender_id: "them",
        source: "live",
        message_type: "text",
        log_payload: "👍",
      };
      persist([...messages, m, r]);
    }, 1200);
  };

  const onSend = () => {
    const v = text.trim();
    if (!v) return;
    if (v === "//") {
      setText("");
      onPanic();
      return;
    }
    setText("");
    send({ message_type: "text", log_payload: v });
  };

  const onMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await fileToDataUrl(f);
    send({
      message_type: f.type.startsWith("video") ? "video" : "image",
      log_payload: url,
    });
    e.target.value = "";
  };

  const onStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await fileToDataUrl(f);
    const s: Story = {
      id: uid(),
      sender_id: "me",
      media_type: f.type.startsWith("video") ? "video" : "image",
      media_url: url,
      created_at: Date.now(),
      expires_at: Date.now() + 24 * 60 * 60 * 1000,
    };
    const next = [...cacheRepo.list(), s];
    cacheRepo.save(next);
    setStories(next);
    e.target.value = "";
  };

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: pickAudioMime() });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const url = await fileToDataUrl(blob);
        send({ message_type: "audio", log_payload: url });
        setRecording(false);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      alert("Microphone access denied.");
    }
  };

  return (
    <div className="h-dvh w-full flex flex-col bg-[#efeae2]">
      {/* Disguised header */}
      <header className="bg-[#f6f6f6] border-b border-[#e2e2e2] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-medium text-[#333] font-mono">System Diagnostics</h1>
          <p className="text-[11px] text-[#888] font-mono">v2.14.3 · 0 errors</p>
        </div>
        <button
          onClick={onClose}
          className="text-[12px] text-red-600 hover:underline font-mono"
        >
          Close Session
        </button>
      </header>

      {/* Stories */}
      <div className="bg-white border-b border-[#e2e2e2] px-3 py-3 flex gap-3 overflow-x-auto">
        <button
          onClick={() => storyRef.current?.click()}
          className="flex flex-col items-center gap-1 shrink-0"
        >
          <div className="size-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center text-white text-xl">
            +
          </div>
          <span className="text-[10px] text-[#666]">Your story</span>
        </button>
        {stories.map((s) => (
          <button key={s.id} className="flex flex-col items-center gap-1 shrink-0">
            <div className="size-14 rounded-full p-[2px] bg-gradient-to-tr from-emerald-500 to-emerald-300">
              {s.media_type === "image" ? (
                <img src={s.media_url} className="size-full rounded-full object-cover border-2 border-white" alt="" />
              ) : (
                <video src={s.media_url} className="size-full rounded-full object-cover border-2 border-white" />
              )}
            </div>
            <span className="text-[10px] text-[#666]">{timeLeft(s.expires_at)}</span>
          </button>
        ))}
        <input ref={storyRef} type="file" accept="image/*,video/*" hidden onChange={onStory} />
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-[#888] mt-10">No messages yet.</p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
      </div>

      {/* Composer */}
      <div className="bg-[#f6f6f6] border-t border-[#e2e2e2] px-2 py-2 flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Attach media"
          className="size-10 grid place-items-center text-[#555] hover:bg-black/5 rounded-full shrink-0"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onMedia} />

        <div className="flex-1 bg-white rounded-2xl px-3 py-2 min-h-[40px] flex items-center">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Message"
            rows={1}
            className="w-full resize-none outline-none text-[15px] bg-transparent max-h-32"
          />
        </div>

        {text.trim() ? (
          <button
            onClick={onSend}
            aria-label="Send"
            className="size-10 grid place-items-center bg-[#00a884] text-white rounded-full shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={toggleRecord}
            aria-label="Record voice note"
            className={`size-10 grid place-items-center rounded-full shrink-0 text-white ${
              recording ? "bg-red-600 animate-pulse" : "bg-[#00a884]"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.sender_id === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-2 py-1.5 shadow-sm ${
          mine ? "bg-[#d9fdd3] rounded-br-sm" : "bg-white rounded-bl-sm"
        }`}
      >
        {m.message_type === "text" && (
          <p className="text-[15px] leading-snug text-[#111] whitespace-pre-wrap break-words px-1">
            {m.log_payload}
          </p>
        )}
        {m.message_type === "image" && (
          <img src={m.log_payload} alt="" className="rounded-xl max-h-72 object-cover" />
        )}
        {m.message_type === "video" && (
          <video src={m.log_payload} controls className="rounded-xl max-h-72" />
        )}
        {m.message_type === "audio" && (
          <audio src={m.log_payload} controls className="h-10" />
        )}
        <div className="text-[10px] text-[#667781] text-right mt-0.5 pr-1 flex items-center justify-end gap-1">
          {m.source === "archive" && <span title="From archive">📁</span>}
          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
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
