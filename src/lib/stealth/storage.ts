// Camouflaged storage layer. Keys are intentionally bland.
const K = {
  notes: "qn.notes.v1",
  contacts: "sys.idx.v1",
  logs: "sys.logs.v1", // messages by contactId
  cache: "sys.cache.v1",
  archive: "sys.archive.v1",
  meta: "sys.meta.v1",
};

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export type MessageType = "text" | "image" | "video" | "audio";
export type DeliveryStatus = "sent" | "delivered" | "read";

export interface ChatMessage {
  id: string;
  contact_id: string;
  sender_id: "me" | "them";
  message_type: MessageType;
  log_payload: string;
  created_at: number;
  status?: DeliveryStatus;
  reply_to?: string | null;
  source?: "live" | "archive";
}

export interface Contact {
  id: string;
  name: string;
  avatar?: string; // emoji or data url
  color: string; // tailwind gradient classes
  bio?: string;
  online?: boolean;
  last_seen?: number;
  pinned?: boolean;
  muted?: boolean;
}

export interface Story {
  id: string;
  contact_id: string;
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

const SEED_CONTACTS: Contact[] = [
  { id: "c_alex", name: "Alex Carter", avatar: "🦊", color: "from-violet-500 to-fuchsia-500", bio: "Designer · Lisbon", online: true, pinned: true },
  { id: "c_maya", name: "Maya Lin", avatar: "🌸", color: "from-pink-500 to-rose-500", bio: "Hey there! I am using QuickNotes.", online: false, last_seen: Date.now() - 12 * 60_000 },
  { id: "c_jin",  name: "Jin Park",   avatar: "🎧", color: "from-sky-500 to-cyan-500", bio: "Producer", online: true },
  { id: "c_sam",  name: "Sam Rivera", avatar: "🌿", color: "from-emerald-500 to-teal-500", bio: "Travel · Coffee", online: false, last_seen: Date.now() - 3 * 3600_000 },
  { id: "c_noor", name: "Noor Hadid", avatar: "📚", color: "from-amber-500 to-orange-500", bio: "PhD candidate", online: false, last_seen: Date.now() - 26 * 3600_000 },
];

export const contactsRepo = {
  list: (): Contact[] => {
    const c = read<Contact[]>(K.contacts, []);
    if (c.length === 0) {
      write(K.contacts, SEED_CONTACTS);
      return SEED_CONTACTS;
    }
    return c;
  },
  save: (c: Contact[]) => write(K.contacts, c),
};

export const logsRepo = {
  list: (): ChatMessage[] => read<ChatMessage[]>(K.logs, []),
  save: (m: ChatMessage[]) => write(K.logs, m),
};

export const archiveRepo = {
  list: (): ChatMessage[] => read<ChatMessage[]>(K.archive, []),
  save: (m: ChatMessage[]) => write(K.archive, m),
};

export const cacheRepo = {
  list: (): Story[] => read<Story[]>(K.cache, []),
  save: (s: Story[]) => write(K.cache, s),
};

/** Unified timeline for a given contact, merging live + archive. */
export async function fetchUnifiedTimeline(contactId: string): Promise<ChatMessage[]> {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const all = logsRepo.list().filter((m) => m.contact_id === contactId);
  const live = all.filter((m) => m.created_at >= cutoff).map((m) => ({ ...m, source: "live" as const }));
  const archive = archiveRepo.list()
    .filter((m) => m.contact_id === contactId)
    .concat(all.filter((m) => m.created_at < cutoff))
    .map((m) => ({ ...m, source: "archive" as const }));
  const map = new Map<string, ChatMessage>();
  [...archive, ...live].forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((a, b) => a.created_at - b.created_at);
}

export async function archiveOldLogs(): Promise<{ moved: number }> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const all = logsRepo.list();
  const stale = all.filter((m) => m.created_at < cutoff);
  if (!stale.length) return { moved: 0 };
  archiveRepo.save([...archiveRepo.list(), ...stale]);
  logsRepo.save(all.filter((m) => m.created_at >= cutoff));
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

/* ---- Smart auto-reply generator (simulated "other person") ---- */
const REPLY_BANK = [
  "haha that's wild 😂", "okayyy 👀", "for real?", "lol same", "tell me more",
  "🔥🔥🔥", "wait what", "I'm dead 💀", "send pics?", "omw", "miss you ❤️",
  "let's catch up tmrw", "sounds good", "👍", "noted", "you up?",
];
export function generateReply(lastText?: string): string {
  if (!lastText) return REPLY_BANK[Math.floor(Math.random() * REPLY_BANK.length)];
  const t = lastText.toLowerCase();
  if (/\b(hi|hey|hello|yo)\b/.test(t)) return "hey! how's it going?";
  if (/\?/.test(t)) return "hmm let me think… yeah probably";
  if (/love|miss/.test(t)) return "miss you too ❤️";
  if (/food|eat|hungry/.test(t)) return "I could eat 🍜";
  if (/work|tired/.test(t)) return "ugh same. need a break";
  return REPLY_BANK[Math.floor(Math.random() * REPLY_BANK.length)];
}
