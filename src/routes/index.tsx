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

const SESSION_KEY = "qn.diag.open";

function Index() {
  const [unlocked, setUnlocked] = useState(false);
  const [forcedNote, setForcedNote] = useState<Note | null>(null);

  // Restore the hidden layer after an OAuth round-trip (the provider redirect
  // reloads the page, which would otherwise drop the user back to notes and
  // make Google sign-in look like it silently failed).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
    } catch { /* storage blocked */ }
  }, []);

  useEffect(() => {
    try {
      if (unlocked) sessionStorage.setItem(SESSION_KEY, "1");
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* storage blocked */ }
  }, [unlocked]);

  // Emergency privacy: lock only when the tab is actually hidden (app switch /
  // screen off). A plain window `blur` also fires for file pickers, the camera
  // sheet and the editor preview iframe, which used to lock mid-action and made
  // sending media or posting a story impossible.
  useEffect(() => {
    if (!unlocked) return;
    const onVis = () => {
      const w = window as unknown as { __quickNotesFilePickerUntil?: number; __quickNotesOAuthUntil?: number };
      const guardUntil = Math.max(w.__quickNotesFilePickerUntil ?? 0, w.__quickNotesOAuthUntil ?? 0);
      if (document.visibilityState === "hidden" && Date.now() > guardUntil) setUnlocked(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
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
