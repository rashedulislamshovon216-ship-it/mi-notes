import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NotesApp } from "@/components/stealth/NotesApp";
import { Messenger } from "@/components/stealth/Messenger";
import { MOCK_STUDY_NOTE, Note, uid } from "@/lib/stealth/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuickNotes" },
      { name: "description", content: "Minimal, fast personal notes that sync across your devices." },
      { property: "og:title", content: "QuickNotes" },
      { property: "og:description", content: "Minimal, fast personal notes." },
    ],
  }),
  component: Index,
});

function Index() {
  const [unlocked, setUnlocked] = useState(false);
  const [forcedNote, setForcedNote] = useState<Note | null>(null);

  // Emergency privacy: lock if the tab/app loses focus.
  useEffect(() => {
    if (!unlocked) return;
    const lock = () => setUnlocked(false);
    const onVis = () => document.hidden && lock();
    window.addEventListener("blur", lock);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", lock);
    return () => {
      window.removeEventListener("blur", lock);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", lock);
    };
  }, [unlocked]);

  const panic = () => {
    setForcedNote({
      id: uid(),
      title: "Chapter 4 — Cellular Respiration",
      body: MOCK_STUDY_NOTE,
      updatedAt: Date.now(),
    });
    setUnlocked(false);
  };

  return unlocked ? (
    <Messenger onClose={() => setUnlocked(false)} onPanic={panic} />
  ) : (
    <NotesApp onSecret={() => setUnlocked(true)} forcedNote={forcedNote} />
  );
}
