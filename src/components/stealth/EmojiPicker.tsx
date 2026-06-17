import { useMemo, useState } from "react";
import { EMOJI_CATEGORIES, GIF_LIBRARY, STICKER_PACKS, getRecentEmojis, pushRecentEmoji } from "@/lib/stealth/emojis";

interface Props {
  onPickEmoji: (e: string) => void;
  onPickSticker: (sticker: { emoji: string; caption: string }) => void;
  onPickGif: (url: string) => void;
}

type Tab = "emoji" | "stickers" | "gifs";

export function EmojiPicker({ onPickEmoji, onPickSticker, onPickGif }: Props) {
  const [tab, setTab] = useState<Tab>("emoji");
  const [cat, setCat] = useState("smiley");
  const [q, setQ] = useState("");
  const recent = useMemo(getRecentEmojis, [tab]);

  const cats = EMOJI_CATEGORIES.map((c) => c.id === "recent" ? { ...c, items: recent } : c);
  const active = cats.find((c) => c.id === cat) ?? cats[1];
  const items = q ? cats.flatMap((c) => c.items).filter((e) => e.includes(q)) : active.items;

  const filteredGifs = q ? GIF_LIBRARY.filter((g) => g.tag.includes(q.toLowerCase())) : GIF_LIBRARY;

  return (
    <div className="glass-strong border-t border-white/10 px-3 pt-2 pb-3 max-h-72 flex flex-col text-white">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex bg-white/5 rounded-full p-0.5 text-[12px]">
          {(["emoji", "stickers", "gifs"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-full capitalize transition ${tab === t ? "bg-white text-black" : "text-white/60"}`}>
              {t}
            </button>
          ))}
        </div>
        {tab !== "stickers" && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            className="flex-1 bg-white/5 rounded-full px-3 py-1 text-[12px] outline-none placeholder:text-white/40" />
        )}
      </div>

      {tab === "emoji" && (
        <>
          {!q && (
            <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1 mb-1">
              {cats.filter((c) => c.id !== "recent" || c.items.length).map((c) => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className={`shrink-0 size-8 rounded-lg grid place-items-center text-lg transition ${cat === c.id ? "bg-white/15" : "hover:bg-white/5"}`}
                  title={c.label}>
                  {c.icon}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-8 gap-0.5 overflow-y-auto flex-1">
            {items.map((e, i) => (
              <button key={e + i} onClick={() => { onPickEmoji(e); pushRecentEmoji(e); }}
                className="text-2xl size-9 grid place-items-center rounded-md hover:bg-white/10 active:scale-90 transition">{e}</button>
            ))}
          </div>
        </>
      )}

      {tab === "stickers" && (
        <div className="overflow-y-auto flex-1 space-y-3">
          {STICKER_PACKS.map((p) => (
            <div key={p.id}>
              <div className="text-[11px] text-white/50 mb-1 uppercase tracking-wider">{p.name}</div>
              <div className="grid grid-cols-4 gap-2">
                {p.stickers.map((s) => (
                  <button key={s.id} onClick={() => onPickSticker(s)}
                    className="aspect-square rounded-2xl glass-soft hover:bg-white/10 active:scale-95 transition flex flex-col items-center justify-center gap-0.5">
                    <span className="text-3xl">{s.emoji}</span>
                    <span className="text-[9px] text-white/60">{s.caption}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "gifs" && (
        <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
          {filteredGifs.map((g) => (
            <button key={g.id} onClick={() => onPickGif(g.url)} className="rounded-xl overflow-hidden hover:opacity-80 active:scale-95 transition aspect-video bg-black/30">
              <img src={g.url} alt={g.tag} className="size-full object-cover" loading="lazy" />
            </button>
          ))}
          {!filteredGifs.length && <p className="col-span-2 text-center text-white/40 text-sm py-8">No GIFs match "{q}".</p>}
        </div>
      )}
    </div>
  );
}
