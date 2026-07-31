import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Eye, Image as ImageIcon, LayoutPanelTop, Maximize2, Mic, Minimize2, Move,
  Pen, Pin, Plus, Search, Square, Star, Trash2, Type, X,
} from "lucide-react";
import { NOTE_TAGS, Note, NoteAttachment, NoteCanvasItem, NoteTag, SECRET_TITLE, notesRepo, uid } from "@/lib/stealth/storage";
import { noteStats, renderNotePreview } from "@/lib/stealth/markdown";

interface Props {
  onSecret: () => void;
  forcedNote?: Note | null;
}

const tagMeta = (id?: NoteTag) => NOTE_TAGS.find((t) => t.id === (id ?? "none")) ?? NOTE_TAGS[0];

export function NotesApp({ onSecret, forcedNote }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<NoteTag | "all">("all");
  const [preview, setPreview] = useState(false);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    setNotes(notesRepo.list());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) notesRepo.save(notes);
  }, [notes, hydrated]);

  useEffect(() => {
    if (forcedNote) {
      setNotes((n) => [{ ...forcedNote, tag: "study" }, ...n.filter((x) => x.id !== forcedNote.id)]);
      setActiveId(forcedNote.id);
      setPreview(true);
    }
  }, [forcedNote]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return notes
      .filter((n) => (tagFilter === "all" ? true : (n.tag ?? "none") === tagFilter))
      .filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.updatedAt - a.updatedAt);
  }, [notes, query, tagFilter]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const create = () => {
    const n: Note = { id: uid(), title: "", body: "", updatedAt: Date.now(), createdAt: Date.now(), tag: "none" };
    setNotes((p) => [n, ...p]);
    setActiveId(n.id);
    setPreview(false);
  };

  const update = (patch: Partial<Note>) => {
    if (!active) return;
    setNotes((p) => p.map((n) => (n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
  };

  const commitTitle = (title: string) => {
    if (title.trim() === SECRET_TITLE) {
      setNotes((p) => p.filter((n) => n.id !== active?.id));
      setActiveId(null);
      onSecret();
    }
  };

  const remove = (id: string) => {
    setNotes((p) => p.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const totals = useMemo(() => {
    const words = notes.reduce((s, n) => s + noteStats(n.body).words, 0);
    return { count: notes.length, words };
  }, [notes]);

  return (
    <div className="h-dvh w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
      {/* ---------------- Library ---------------- */}
      <aside
        className={`${active ? "hidden" : "flex"} md:flex flex-col flex-1 min-h-0 md:flex-none w-full md:w-[360px] md:border-r border-border bg-sidebar`}
      >
        <header className="px-5 pt-7 pb-4">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-[28px] leading-none font-semibold gild">QuickNotes</h1>
              <p className="text-[11px] text-muted-foreground mt-2 tracking-wide">
                {totals.count} notes · {totals.words.toLocaleString()} words written
              </p>
            </div>
            <button
              onClick={create}
              aria-label="New note"
              className="size-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/20 active:scale-95 transition"
            >
              <Plus className="size-5" />
            </button>
          </div>

          <div className="mt-5 relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your notes"
              className="w-full bg-card hairline rounded-2xl pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 ring-ring/40"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          </div>

          <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none">
            {(["all", ...NOTE_TAGS.map((t) => t.id)] as const).map((t) => {
              const meta = t === "all" ? null : tagMeta(t as NoteTag);
              const on = tagFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setTagFilter(t as NoteTag | "all")}
                  className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full transition flex items-center gap-1.5 ${
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {meta && <span className="size-1.5 rounded-full" style={{ background: meta.dot }} />}
                  {t === "all" ? "All" : meta!.label}
                </button>
              );
            })}
          </div>
        </header>

        <ul className="flex-1 overflow-y-auto px-3 pb-8 space-y-2.5">
          {hydrated && filtered.length === 0 && (
            <li className="px-4 py-16 text-center">
              <p className="font-display text-lg">A blank, beautiful page</p>
              <p className="text-sm text-muted-foreground mt-1.5">
                Tap ＋ to start. Markdown, checklists, code and voice memos all work.
              </p>
            </li>
          )}
          {filtered.map((n) => {
            const s = noteStats(n.body);
            const meta = tagMeta(n.tag);
            return (
              <li key={n.id}>
                <button
                  onClick={() => { setActiveId(n.id); setPreview(false); }}
                  className={`w-full text-left rounded-2xl p-4 paper transition active:scale-[0.99] ${
                    activeId === n.id ? "ring-2 ring-primary/40" : "hairline"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {n.tag && n.tag !== "none" && (
                      <span className="size-2 rounded-full shrink-0" style={{ background: meta.dot }} />
                    )}
                    <span className="font-display font-semibold truncate">{n.title || "Untitled"}</span>
                    {n.pinned && <Pin className="size-3 text-accent-foreground/70 ml-auto shrink-0" />}
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {n.body.replace(/[#*`>]/g, "").slice(0, 120) || "No additional text"}
                  </p>
                  <div className="flex items-center gap-2 mt-2.5 text-[10px] text-muted-foreground tracking-wide">
                    <span>{new Date(n.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    <span>·</span>
                    <span>{s.words} words</span>
                    {s.tasks > 0 && <><span>·</span><span>{s.done}/{s.tasks} done</span></>}
                    {(n.attachments?.length ?? 0) > 0 && <><span>·</span><span>{n.attachments!.length} media</span></>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ---------------- Editor ---------------- */}
      <main className={`${active ? "flex" : "hidden"} md:flex flex-1 flex-col min-w-0`}>
        {active ? (
          <Editor
            key={active.id}
            note={active}
            preview={preview}
            focus={focus}
            onTogglePreview={() => setPreview((p) => !p)}
            onToggleFocus={() => setFocus((f) => !f)}
            onBack={() => setActiveId(null)}
            onChange={update}
            onCommitTitle={commitTitle}
            onDelete={() => remove(active.id)}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-center px-10">
            <div>
              <p className="font-display text-xl">Select a note</p>
              <p className="text-sm text-muted-foreground mt-1.5">Or create one — it saves as you type.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* =============================== EDITOR =============================== */
function Editor({
  note, preview, focus, onTogglePreview, onToggleFocus, onBack, onChange, onCommitTitle, onDelete,
}: {
  note: Note;
  preview: boolean;
  focus: boolean;
  onTogglePreview: () => void;
  onToggleFocus: () => void;
  onBack: () => void;
  onChange: (patch: Partial<Note>) => void;
  onCommitTitle: (t: string) => void;
  onDelete: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [mode, setMode] = useState<"write" | "canvas">("write");
  const s = noteStats(note.body);
  const meta = tagMeta(note.tag);

  const markPicker = () => {
    (window as unknown as { __quickNotesFilePickerUntil?: number }).__quickNotesFilePickerUntil = Date.now() + 12_000;
  };

  const wrap = (before: string, after = before) => {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const body = note.body;
    const next = body.slice(0, a) + before + body.slice(a, b) + after + body.slice(b);
    onChange({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, b + before.length);
    });
  };

  const prefixLine = (prefix: string) => {
    const el = areaRef.current;
    if (!el) return;
    const a = el.selectionStart;
    const start = note.body.lastIndexOf("\n", a - 1) + 1;
    const next = note.body.slice(0, start) + prefix + note.body.slice(start);
    onChange({ body: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefix.length, a + prefix.length); });
  };

  const addAttachment = (att: NoteAttachment) =>
    onChange({ attachments: [...(note.attachments ?? []), att] });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () =>
      addAttachment({
        id: uid(),
        kind: f.type.startsWith("image") ? "image" : f.type.startsWith("video") ? "video" : "file",
        dataUrl: String(reader.result),
        name: f.name,
      });
    reader.readAsDataURL(f);
  };

  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        const reader = new FileReader();
        reader.onload = () =>
          addAttachment({ id: uid(), kind: "audio", dataUrl: String(reader.result), name: "Voice memo" });
        reader.readAsDataURL(blob);
        setRecording(false);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 md:px-5 py-2.5 border-b border-border">
        <button onClick={onBack} className="md:hidden size-9 grid place-items-center rounded-full hover:bg-secondary">
          <ArrowLeft className="size-5" />
        </button>

        <button
          onClick={() => setTagOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full bg-secondary text-secondary-foreground"
        >
          <span className="size-2 rounded-full" style={{ background: meta.dot }} />
          {meta.label}
        </button>

        <button
          onClick={() => onChange({ pinned: !note.pinned })}
          className={`size-9 grid place-items-center rounded-full hover:bg-secondary ${note.pinned ? "text-primary" : "text-muted-foreground"}`}
          aria-label="Pin note"
        >
          <Star className={`size-4 ${note.pinned ? "fill-current" : ""}`} />
        </button>

        <span className="ml-auto text-[11px] text-muted-foreground hidden sm:block">
          {s.words} words · {s.minutes} min read
        </span>

        <button onClick={onTogglePreview} className="size-9 grid place-items-center rounded-full hover:bg-secondary" aria-label="Toggle preview">
          {preview ? <Pen className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button
          onClick={() => { setMode((m) => (m === "canvas" ? "write" : "canvas")); if (preview) onTogglePreview(); }}
          className={`size-9 grid place-items-center rounded-full hover:bg-secondary ${mode === "canvas" ? "text-primary" : ""}`}
          aria-label="Canvas mode"
        >
          <LayoutPanelTop className="size-4" />
        </button>
        <button onClick={onToggleFocus} className="size-9 grid place-items-center rounded-full hover:bg-secondary" aria-label="Focus mode">
          {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button onClick={onDelete} className="size-9 grid place-items-center rounded-full text-destructive hover:bg-destructive/10" aria-label="Delete note">
          <Trash2 className="size-4" />
        </button>
      </div>

      {tagOpen && (
        <div className="px-3 md:px-6 py-2 flex gap-1.5 overflow-x-auto scrollbar-none border-b border-border">
          {NOTE_TAGS.map((t) => (
            <button
              key={t.id}
              onClick={() => { onChange({ tag: t.id }); setTagOpen(false); }}
              className="shrink-0 flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-secondary"
            >
              <span className="size-2 rounded-full" style={{ background: t.dot }} />
              {t.label}
              {(note.tag ?? "none") === t.id && <Check className="size-3" />}
            </button>
          ))}
        </div>
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto ${focus ? "max-w-[680px] w-full mx-auto" : ""}`}>
        <input
          value={note.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={(e) => onCommitTitle(e.target.value)}
          placeholder="Title"
          className="w-full px-4 md:px-8 pt-7 pb-1 font-display text-[26px] md:text-[32px] font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        <p className="px-4 md:px-8 text-[11px] text-muted-foreground pb-3">
          {new Date(note.updatedAt).toLocaleString()} {s.tasks > 0 && `· ${s.done}/${s.tasks} tasks done`}
        </p>

        {preview ? (
          <div className="px-4 md:px-8 pb-10">{renderNotePreview(note.body)}</div>
        ) : mode === "canvas" ? (
          <CanvasBoard note={note} onChange={onChange} />
        ) : (
          <textarea
            ref={areaRef}
            value={note.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder={"Start writing…\n\n# Heading\n- [ ] a task\n> a quote\n```js\nconst x = 1\n```"}
            className="w-full min-h-[45vh] px-4 md:px-8 pb-8 text-[15.5px] leading-[1.8] bg-transparent outline-none resize-none"
          />
        )}

        {(note.attachments?.length ?? 0) > 0 && (
          <div className="px-4 md:px-8 pb-10 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {note.attachments!.map((a) => (
              <div key={a.id} className="relative rounded-2xl overflow-hidden hairline paper p-2">
                {a.kind === "image" ? (
                  <img src={a.dataUrl} alt={a.name ?? "attachment"} className="w-full h-28 object-cover rounded-xl" />
                ) : a.kind === "video" ? (
                  <video src={a.dataUrl} controls className="w-full h-28 object-cover rounded-xl" />
                ) : a.kind === "audio" ? (
                  <audio src={a.dataUrl} controls className="w-full" />
                ) : (
                  <a href={a.dataUrl} download={a.name ?? "note-file"} className="flex h-28 items-center justify-center rounded-xl bg-secondary px-3 text-center text-xs text-muted-foreground">{a.name ?? "Download file"}</a>
                )}
                <button
                  onClick={() => onChange({ attachments: (note.attachments ?? []).filter((x) => x.id !== a.id) })}
                  className="absolute top-3 right-3 size-6 rounded-full bg-background/80 grid place-items-center"
                  aria-label="Remove attachment"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!preview && (
        <div className="flex items-center gap-1 px-2 md:px-6 py-2 border-t border-border overflow-x-auto scrollbar-none pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <ToolBtn onClick={() => wrap("**")}>B</ToolBtn>
          <ToolBtn onClick={() => wrap("*")}><span className="italic">i</span></ToolBtn>
          <ToolBtn onClick={() => wrap("==")}>◒</ToolBtn>
          <ToolBtn onClick={() => wrap("`")}>{"</>"}</ToolBtn>
          <ToolBtn onClick={() => wrap("\n```\n", "\n```\n")}>{"{ }"}</ToolBtn>
          <ToolBtn onClick={() => prefixLine("# ")}>H</ToolBtn>
          <ToolBtn onClick={() => prefixLine("- ")}>•</ToolBtn>
          <ToolBtn onClick={() => prefixLine("- [ ] ")}><Square className="size-3.5" /></ToolBtn>
          <ToolBtn onClick={() => prefixLine("> ")}>❞</ToolBtn>
          <span className="mx-1 w-px h-5 bg-border shrink-0" />
          <ToolBtn onClick={() => { markPicker(); fileRef.current?.click(); }}><ImageIcon className="size-4" /></ToolBtn>
          <ToolBtn onClick={toggleRecord} active={recording}><Mic className="size-4" /></ToolBtn>
          <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.txt,.md,.json,.html,.css,.js" hidden onChange={onFile} />
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0 pl-2 sm:hidden">{s.words}w</span>
        </div>
      )}
    </div>
  );
}

function CanvasBoard({ note, onChange }: { note: Note; onChange: (patch: Partial<Note>) => void }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const items = note.canvasItems ?? [];

  const markPicker = () => {
    (window as unknown as { __quickNotesFilePickerUntil?: number }).__quickNotesFilePickerUntil = Date.now() + 12_000;
  };
  const saveItems = (next: NoteCanvasItem[]) => onChange({ canvasItems: next });
  const addText = () => saveItems([...items, { id: uid(), kind: "text", x: 28, y: 28 + items.length * 18, w: 210, h: 132, text: "New idea…", color: "gold" }]);
  const patchItem = (id: string, patch: Partial<NoteCanvasItem>) => saveItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => saveItems(items.filter((it) => it.id !== id));

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => saveItems([...items, { id: uid(), kind: "image", x: 34, y: 34 + items.length * 20, w: 230, h: 170, dataUrl: String(reader.result) }]);
    reader.readAsDataURL(f);
  };

  const move = (clientX: number, clientY: number) => {
    if (!drag || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    patchItem(drag.id, {
      x: Math.max(8, Math.min(rect.width - 72, clientX - rect.left - drag.dx)),
      y: Math.max(8, Math.min(rect.height - 72, clientY - rect.top - drag.dy)),
    });
  };

  return (
    <div className="px-4 md:px-8 pb-10">
      <div className="mb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button onClick={addText} className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground flex items-center gap-1.5">
          <Type className="size-3.5" /> Text
        </button>
        <button onClick={() => { markPicker(); imageRef.current?.click(); }} className="shrink-0 rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground flex items-center gap-1.5">
          <ImageIcon className="size-3.5" /> Image
        </button>
        <span className="text-[11px] text-muted-foreground">Drag cards freely around the canvas</span>
        <input ref={imageRef} type="file" accept="image/*" hidden onChange={addImage} />
      </div>
      <div
        ref={boardRef}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={() => setDrag(null)}
        className="relative min-h-[62vh] overflow-hidden rounded-[28px] border border-border bg-card paper"
      >
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]" />
        {items.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-center text-sm text-muted-foreground px-8">
            <div><Move className="mx-auto mb-2 size-6 opacity-50" />Add text or images, then arrange them like a private moodboard.</div>
          </div>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            className={`absolute z-10 rounded-2xl border border-foreground/10 shadow-xl touch-none ${it.color === "rose" ? "bg-rose-100" : it.color === "mint" ? "bg-emerald-100" : it.color === "ink" ? "bg-primary text-primary-foreground" : "bg-amber-100"}`}
            style={{ left: it.x, top: it.y, width: it.w, minHeight: it.h }}
          >
            <div
              onMouseDown={(e) => setDrag({ id: it.id, dx: e.nativeEvent.offsetX, dy: e.nativeEvent.offsetY })}
              onTouchStart={(e) => {
                const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                setDrag({ id: it.id, dx: e.touches[0].clientX - r.left, dy: e.touches[0].clientY - r.top });
              }}
              className="flex cursor-grab items-center gap-1.5 rounded-t-2xl px-2 py-1.5 text-[10px] opacity-70 active:cursor-grabbing"
            >
              <Move className="size-3" /> move
              <button onClick={() => removeItem(it.id)} className="ml-auto rounded-full p-1 hover:bg-foreground/10" aria-label="Remove canvas item"><X className="size-3" /></button>
            </div>
            {it.kind === "text" ? (
              <textarea value={it.text ?? ""} onChange={(e) => patchItem(it.id, { text: e.target.value })}
                className="min-h-24 w-full resize-none bg-transparent px-3 pb-3 text-sm leading-relaxed outline-none" />
            ) : (
              <img src={it.dataUrl} alt="Canvas attachment" className="w-full rounded-b-2xl object-cover" style={{ minHeight: it.h - 28 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`size-9 shrink-0 grid place-items-center rounded-xl text-[13px] font-semibold transition ${
        active ? "bg-destructive text-primary-foreground animate-pulse" : "hover:bg-secondary text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
