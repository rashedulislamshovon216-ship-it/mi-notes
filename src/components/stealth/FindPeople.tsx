import { useMemo, useState } from "react";
import { X, UserPlus, Search } from "lucide-react";
import { AVATAR_EMOJIS, Contact, contactsRepo } from "@/lib/stealth/storage";

interface Props {
  onClose: () => void;
  onAdded: (c: Contact) => void;
  existing: Contact[];
}

const SUGGESTIONS = [
  { name: "Ava Reed", avatar: "🌷", bio: "designer · 🍵" },
  { name: "Leo Tan", avatar: "🎸", bio: "guitarist" },
  { name: "Ivy Chen", avatar: "🐱", bio: "loves cats more than people" },
  { name: "Kai Brooks", avatar: "🌊", bio: "surf · run · sleep" },
  { name: "Mira Patel", avatar: "📷", bio: "film photography" },
  { name: "Theo Park", avatar: "☕", bio: "barista · brewing" },
  { name: "Ren Yamada", avatar: "🌙", bio: "night owl 🦉" },
  { name: "Sofi Vega", avatar: "🍓", bio: "berry busy" },
];

export function FindPeople({ onClose, onAdded, existing }: Props) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(AVATAR_EMOJIS[0]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return SUGGESTIONS
      .filter((s) => !existing.find((e) => e.name.toLowerCase() === s.name.toLowerCase()))
      .filter((s) => !ql || s.name.toLowerCase().includes(ql) || s.bio.toLowerCase().includes(ql));
  }, [q, existing]);

  const addSuggested = (s: { name: string; avatar: string; bio: string }) => {
    const c = contactsRepo.add(s);
    onAdded(c);
  };

  const addCustom = () => {
    if (!name.trim()) return;
    const c = contactsRepo.add({ name, avatar: emoji });
    onAdded(c);
    setName("");
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md glass-strong rounded-t-3xl sm:rounded-3xl text-white flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-lg font-semibold">Find people</h2>
          <button onClick={onClose} className="size-9 rounded-full hover:bg-white/10 grid place-items-center"><X className="size-5" /></button>
        </div>

        {/* invite by name */}
        <div className="px-5 pb-3">
          <p className="text-xs text-[var(--msg-muted)] mb-2">Add a friend by name</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEmoji(AVATAR_EMOJIS[(AVATAR_EMOJIS.indexOf(emoji) + 1) % AVATAR_EMOJIS.length])}
              className="size-12 shrink-0 rounded-full glass grid place-items-center text-2xl"
              title="Tap to cycle avatar"
            >
              {emoji}
            </button>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name…"
              className="flex-1 glass-soft rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-white/40"
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button onClick={addCustom}
              className="size-11 rounded-full bg-white text-black grid place-items-center shrink-0 disabled:opacity-40 active:scale-95 transition"
              disabled={!name.trim()}>
              <UserPlus className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search suggestions…"
              className="w-full glass-soft rounded-full pl-9 pr-4 py-2.5 text-sm outline-none placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="overflow-y-auto px-2 pb-4 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-white/40 px-3 pb-1 pt-1">Suggested for you</p>
          <ul>
            {filtered.map((s) => (
              <li key={s.name}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5">
                  <div className="size-11 rounded-full bg-gradient-to-br from-white/15 to-white/5 grid place-items-center text-xl">{s.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-white/50 truncate">{s.bio}</p>
                  </div>
                  <button onClick={() => addSuggested(s)}
                    className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold active:scale-95 transition">
                    Add
                  </button>
                </div>
              </li>
            ))}
            {!filtered.length && <li className="text-center text-white/40 text-sm py-8">All caught up ✨</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
