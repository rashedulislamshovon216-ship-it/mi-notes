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
