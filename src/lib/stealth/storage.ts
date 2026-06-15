// Camouflaged storage layer. Keys are intentionally bland.
const K = {
  notes: "qn.notes.v1",
  logs: "sys.logs.v1",
  cache: "sys.cache.v1",
  archive: "sys.archive.v1",
};

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export type MessageType = "text" | "image" | "video" | "audio";
export interface ChatMessage {
  id: string;
  sender_id: "me" | "them";
  message_type: MessageType;
  log_payload: string; // text or data url
  created_at: number;
  source?: "live" | "archive";
}

export interface Story {
  id: string;
  sender_id: "me" | "them";
  media_type: "image" | "video";
  media_url: string;
  created_at: number;
  expires_at: number;
}

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const notesRepo = {
  list: () => read<Note[]>(K.notes, []),
  save: (n: Note[]) => write(K.notes, n),
};

export const logsRepo = {
  list: () => read<ChatMessage[]>(K.logs, []),
  save: (m: ChatMessage[]) => write(K.logs, m),
};

export const archiveRepo = {
  list: () => read<ChatMessage[]>(K.archive, []),
  save: (m: ChatMessage[]) => write(K.archive, m),
};

export const cacheRepo = {
  list: () => read<Story[]>(K.cache, []),
  save: (s: Story[]) => write(K.cache, s),
};

/**
 * Simulated hybrid fetcher.
 * Source A: live (last 24h) — would be Supabase `system_logs`.
 * Source B: archive (>24h)  — would be a Google Sheets API wrapper.
 * Merged and sorted chronologically into one continuous timeline.
 */
export async function fetchUnifiedTimeline(): Promise<ChatMessage[]> {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;

  const all = logsRepo.list();
  const live = all.filter((m) => m.created_at >= cutoff).map((m) => ({ ...m, source: "live" as const }));
  const archive = archiveRepo
    .list()
    .concat(all.filter((m) => m.created_at < cutoff))
    .map((m) => ({ ...m, source: "archive" as const }));

  // de-dupe by id, archive loses to live
  const map = new Map<string, ChatMessage>();
  [...archive, ...live].forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((a, b) => a.created_at - b.created_at);
}

/**
 * Simulated archive job — in production this is a cron/edge function that
 * pipes rows older than 24h from Supabase `system_logs` into Google Sheets
 * and deletes them from the live table to stay under the 500MB free tier.
 */
export async function archiveOldLogs(): Promise<{ moved: number }> {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const all = logsRepo.list();
  const stale = all.filter((m) => m.created_at < cutoff);
  if (!stale.length) return { moved: 0 };

  const archive = archiveRepo.list();
  archiveRepo.save([...archive, ...stale]);
  logsRepo.save(all.filter((m) => m.created_at >= cutoff));

  // In production:
  // 1. POST stale rows to Google Sheets API wrapper
  // 2. await supabase.from('system_logs').delete().lt('created_at', cutoff)
  return { moved: stale.length };
}

export function pruneExpiredStories(): Story[] {
  const now = Date.now();
  const live = cacheRepo.list().filter((s) => s.expires_at > now);
  cacheRepo.save(live);
  return live;
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const SECRET_TITLE = "sys.log.override";

export const MOCK_STUDY_NOTE = `# Chapter 4 — Cellular Respiration

Cellular respiration is the process by which cells break down glucose
to produce ATP. It occurs in three main stages:

1. **Glycolysis** — glucose is split into two pyruvate molecules in the
   cytoplasm, yielding 2 ATP and 2 NADH.
2. **Krebs Cycle** — pyruvate enters the mitochondria and is fully
   oxidized to CO₂, generating NADH and FADH₂.
3. **Electron Transport Chain** — NADH and FADH₂ donate electrons,
   driving ATP synthase to produce ~32 ATP per glucose molecule.

Overall equation:
C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + ~36 ATP
`;
