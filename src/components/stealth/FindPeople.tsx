import { useEffect, useMemo, useState } from "react";
import { X, UserPlus, Search, AtSign, Loader2, Bookmark } from "lucide-react";
import { CloudProfile, displayNameOf, searchPeople, startDm } from "@/lib/stealth/cloud";
import { Avatar } from "./Avatar";

interface Props {
  onClose: () => void;
  onOpenChat: (chatId: string) => Promise<boolean>;
  meId: string;
}

export function FindPeople({ onClose, onOpenChat, meId }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CloudProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      setResults(await searchPeople(term));
      setLoading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const open = async (id: string) => {
    setBusyId(id);
    const chatId = await startDm(id);
    if (chatId) {
      const opened = await onOpenChat(chatId);
      if (opened) onClose();
    }
    setBusyId(null);
  };

  const hint = useMemo(() => q.trim().length && q.trim().length < 2, [q]);

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md glass-strong rounded-t-[28px] sm:rounded-[28px] text-white flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-lg font-semibold tracking-tight">Find people</h2>
          <button onClick={onClose} className="size-9 rounded-full hover:bg-white/10 grid place-items-center"><X className="size-5" /></button>
        </div>

        <p className="px-5 text-xs text-[var(--msg-muted)]">
          Search by @handle or name. Share your own handle so friends can add you.
        </p>

        <div className="px-5 py-3">
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="handle or name…"
              className="w-full glass-soft rounded-full pl-9 pr-10 py-3 text-sm outline-none placeholder:text-white/40"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-white/40" />}
          </div>
        </div>

        <div className="overflow-y-auto px-2 pb-6 flex-1">
          <button onClick={() => open(meId)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 text-left">
            <span className="size-11 rounded-full glass grid place-items-center"><Bookmark className="size-5" /></span>
            <span className="flex-1">
              <span className="block text-sm font-medium">Saved Messages</span>
              <span className="block text-xs text-white/50">Your private self-chat</span>
            </span>
          </button>

          <ul>
            {results.filter((p) => p.id !== meId).map((p) => (
              <li key={p.id}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5">
                  <Avatar profile={p} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayNameOf(p)}</p>
                    <p className="text-xs text-white/50 truncate">@{p.username}</p>
                  </div>
                  <button onClick={() => open(p.id)} disabled={busyId === p.id}
                    className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50">
                    {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                    Chat
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {!loading && q.trim().length >= 2 && results.filter((p) => p.id !== meId).length === 0 && (
            <p className="text-center text-white/40 text-sm py-10">No one found for “{q}”.</p>
          )}
          {(!q.trim() || hint) && (
            <p className="text-center text-white/30 text-xs py-10 flex flex-col items-center gap-2">
              <Search className="size-5" /> Type at least 2 characters
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
