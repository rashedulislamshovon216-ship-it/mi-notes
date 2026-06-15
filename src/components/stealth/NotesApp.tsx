import { useEffect, useMemo, useState } from "react";
import { Note, SECRET_TITLE, notesRepo, uid } from "@/lib/stealth/storage";

interface Props {
  onSecret: () => void;
  forcedNote?: Note | null;
}

export function NotesApp({ onSecret, forcedNote }: Props) {
  const [notes, setNotes] = useState<Note[]>(() => notesRepo.list());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mobileEditing, setMobileEditing] = useState(false);

  useEffect(() => {
    notesRepo.save(notes);
  }, [notes]);

  useEffect(() => {
    if (forcedNote) {
      setNotes((n) => [forcedNote, ...n.filter((x) => x.id !== forcedNote.id)]);
      setActiveId(forcedNote.id);
      setMobileEditing(true);
    }
  }, [forcedNote]);

  const filtered = useMemo(
    () =>
      notes
        .filter(
          (n) =>
            n.title.toLowerCase().includes(query.toLowerCase()) ||
            n.body.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [notes, query],
  );

  const active = notes.find((n) => n.id === activeId) ?? null;

  const create = () => {
    const n: Note = { id: uid(), title: "", body: "", updatedAt: Date.now() };
    setNotes((p) => [n, ...p]);
    setActiveId(n.id);
    setMobileEditing(true);
  };

  const update = (patch: Partial<Note>) => {
    if (!active) return;
    setNotes((p) =>
      p.map((n) => (n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    );
  };

  const commitTitle = (title: string) => {
    if (title.trim() === SECRET_TITLE) {
      // remove the trigger note silently
      setNotes((p) => p.filter((n) => n.id !== active?.id));
      onSecret();
    }
  };

  const remove = (id: string) => {
    setNotes((p) => p.filter((n) => n.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMobileEditing(false);
    }
  };

  return (
    <div className="h-dvh w-full bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside
        className={`${
          mobileEditing ? "hidden" : "flex"
        } md:flex flex-col w-full md:w-80 md:border-r border-border bg-card`}
      >
        <header className="px-5 pt-6 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">QuickNotes</h1>
            <button
              onClick={create}
              aria-label="New note"
              className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center hover:opacity-90 transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <div className="mt-4 relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-muted rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 ring-ring/40"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </div>
        </header>

        <ul className="flex-1 overflow-y-auto px-2 pb-4">
          {filtered.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-muted-foreground">
              No notes yet. Tap + to begin.
            </li>
          )}
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => {
                  setActiveId(n.id);
                  setMobileEditing(true);
                }}
                className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition ${
                  activeId === n.id ? "bg-accent" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium truncate">{n.title || "Untitled"}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {new Date(n.updatedAt).toLocaleDateString()} ·{" "}
                  {n.body.slice(0, 40) || "No additional text"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor */}
      <main className={`${mobileEditing ? "flex" : "hidden"} md:flex flex-1 flex-col`}>
        {active ? (
          <>
            <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-border">
              <button
                className="md:hidden text-sm text-muted-foreground flex items-center gap-1"
                onClick={() => setMobileEditing(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Notes
              </button>
              <span className="text-xs text-muted-foreground">
                {new Date(active.updatedAt).toLocaleString()}
              </span>
              <button
                onClick={() => remove(active.id)}
                className="text-sm text-destructive hover:opacity-80"
              >
                Delete
              </button>
            </div>
            <input
              value={active.title}
              onChange={(e) => update({ title: e.target.value })}
              onBlur={(e) => commitTitle(e.target.value)}
              placeholder="Title"
              className="px-4 md:px-8 pt-6 pb-2 text-2xl md:text-3xl font-semibold bg-transparent outline-none"
            />
            <textarea
              value={active.body}
              onChange={(e) => update({ body: e.target.value })}
              placeholder="Start writing…"
              className="flex-1 px-4 md:px-8 pb-8 text-base leading-relaxed bg-transparent outline-none resize-none"
            />
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
            Select a note or create a new one
          </div>
        )}
      </main>
    </div>
  );
}
