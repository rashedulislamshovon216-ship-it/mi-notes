import { archiveRepo, cacheRepo, contactsRepo, logsRepo, notesRepo } from "./storage";

export interface BackupBundle {
  v: 1;
  exported_at: number;
  notes: ReturnType<typeof notesRepo.list>;
  contacts: ReturnType<typeof contactsRepo.list>;
  logs: ReturnType<typeof logsRepo.list>;
  archive: ReturnType<typeof archiveRepo.list>;
  cache: ReturnType<typeof cacheRepo.list>;
}

export function buildBackup(): BackupBundle {
  return {
    v: 1,
    exported_at: Date.now(),
    notes: notesRepo.list(),
    contacts: contactsRepo.list(),
    logs: logsRepo.list(),
    archive: archiveRepo.list(),
    cache: cacheRepo.list(),
  };
}

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quicknotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ ok: boolean; error?: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as BackupBundle;
    if (data.v !== 1) return { ok: false, error: "Unsupported backup version" };
    notesRepo.save(data.notes ?? []);
    contactsRepo.save(data.contacts ?? []);
    logsRepo.save(data.logs ?? []);
    archiveRepo.save(data.archive ?? []);
    cacheRepo.save(data.cache ?? []);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ---- Cloud backup: pulls chats, messages and stories from the server ---- */
export async function buildCloudBackup() {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const [profile, memberships, stories, contacts] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("chat_members").select("chat_id").eq("user_id", user.id),
    supabase.from("stories").select("*").eq("user_id", user.id),
    supabase.from("contacts").select("*").eq("owner_id", user.id),
  ]);
  const chatIds = (memberships.data ?? []).map((m) => m.chat_id);
  const messages = chatIds.length
    ? (await supabase.from("messages").select("*").in("chat_id", chatIds)).data ?? []
    : [];
  return {
    v: 2 as const,
    exported_at: Date.now(),
    profile: profile.data,
    contacts: contacts.data ?? [],
    chats: chatIds,
    messages,
    stories: stories.data ?? [],
    notes: notesRepo.list(),
  };
}

export async function downloadCloudBackup() {
  const bundle = await buildCloudBackup();
  if (!bundle) return false;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quicknotes-cloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
