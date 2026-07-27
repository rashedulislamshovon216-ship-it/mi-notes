import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { THEMES, ThemeId, applyTheme } from "@/lib/stealth/themes";
import { downloadBackup, downloadCloudBackup, importBackup } from "@/lib/stealth/backup";
import { CloudProfile, myProfile, saveProfile, uploadMedia } from "@/lib/stealth/cloud";
import { Avatar } from "./Avatar";
import { AtSign, Camera, Check, Copy, Loader2, LogOut } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Props {
  open: boolean;
  onClose: () => void;
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
}

const STATUS_EMOJIS = ["🌙", "☕", "🎧", "💤", "🔥", "🌸", "🧊", "🚀", "🍀", "💌", "🐣", "✨", "🫧", "🍓", "🪐", "🎮"];

export function SettingsPanel({ open, onClose, theme, onTheme }: Props) {
  const [tab, setTab] = useState<"account" | "profile" | "theme" | "backup">("profile");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user && open) myProfile().then(setProfile); }, [user, open]);

  const flash = (m: string) => { setStatus(m); setTimeout(() => setStatus(null), 2600); };
  const patch = (p: Partial<CloudProfile>) => setProfile((cur) => (cur ? { ...cur, ...p } : cur));

  const signInGoogle = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (r.error) flash("Google sign-in failed");
  };

  const signInEmail = async () => {
    if (!email || !password) return flash("Email + password required");
    setBusy(true);
    const r = authMode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (r.error) flash(r.error.message);
    else { setEmail(""); setPassword(""); flash(authMode === "signup" ? "Account created — check your inbox." : "Signed in."); }
  };

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); flash("Signed out."); };

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    const handle = (profile.username ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const { error } = await saveProfile({
      username: handle || null,
      display_name: profile.display_name,
      nickname: profile.nickname,
      bio: profile.bio,
      status_emoji: profile.status_emoji,
      avatar_url: profile.avatar_url,
      theme,
    } as Partial<CloudProfile>);
    setBusy(false);
    flash(error ? (error.includes("duplicate") ? "That handle is taken" : error) : "Profile saved ✨");
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy(true);
    const ref = await uploadMedia("avatars", f, f.name.split(".").pop() || "jpg");
    setBusy(false);
    if (!ref) return flash("Upload failed");
    patch({ avatar_url: ref });
    await saveProfile({ avatar_url: ref });
    flash("Avatar updated");
  };

  const copyHandle = () => {
    if (!profile?.username) return;
    navigator.clipboard?.writeText(`@${profile.username}`);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-end sm:place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92dvh] glass-strong rounded-t-[28px] sm:rounded-[28px] overflow-hidden flex flex-col text-white animate-in slide-in-from-bottom-8 duration-300">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          <button onClick={onClose} className="ml-auto size-8 grid place-items-center rounded-full hover:bg-white/10">✕</button>
        </div>

        <nav className="flex gap-1 px-3 py-2 border-b border-white/10 text-[13px]">
          {[["profile", "Profile"], ["theme", "Theme"], ["backup", "Backup"], ["account", "Account"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)}
              className={`px-3 py-1.5 rounded-full transition ${tab === k ? "bg-white text-black font-medium" : "hover:bg-white/10 text-white/70"}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 select-text">
          {tab === "profile" && (
            profile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <button onClick={() => avatarRef.current?.click()} className="relative">
                    <Avatar profile={profile} size={72} />
                    <span className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white text-black grid place-items-center">
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={copyHandle} className="flex items-center gap-1.5 text-sm text-[var(--msg-accent)]">
                      @{profile.username ?? "set-a-handle"} {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                    <p className="text-[11px] text-white/50 mt-1">Share this handle so friends can find you.</p>
                  </div>
                  <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onAvatar} />
                </div>

                <Field label="Handle">
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                    <input value={profile.username ?? ""} onChange={(e) => patch({ username: e.target.value })}
                      className="w-full glass-soft rounded-xl pl-9 pr-4 py-3 outline-none" />
                  </div>
                </Field>
                <Field label="Display name">
                  <input value={profile.display_name ?? ""} onChange={(e) => patch({ display_name: e.target.value })}
                    className="w-full glass-soft rounded-xl px-4 py-3 outline-none" />
                </Field>
                <Field label="Nickname (shown to friends)">
                  <input value={profile.nickname ?? ""} onChange={(e) => patch({ nickname: e.target.value })}
                    className="w-full glass-soft rounded-xl px-4 py-3 outline-none" />
                </Field>
                <Field label="Status">
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_EMOJIS.map((e) => (
                      <button key={e} onClick={() => patch({ status_emoji: profile.status_emoji === e ? null : e })}
                        className={`size-10 rounded-xl text-xl grid place-items-center transition ${profile.status_emoji === e ? "bg-white/20 ring-1 ring-white/40" : "glass-soft hover:bg-white/10"}`}>{e}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Bio">
                  <textarea value={profile.bio ?? ""} onChange={(e) => patch({ bio: e.target.value })} rows={3}
                    className="w-full glass-soft rounded-xl px-4 py-3 outline-none resize-none" />
                </Field>
                <button onClick={save} disabled={busy}
                  className="w-full bg-[var(--msg-accent)] text-[var(--msg-bg)] rounded-xl px-4 py-3 font-medium glow-accent disabled:opacity-50">
                  Save profile
                </button>
              </div>
            ) : <p className="text-white/60 text-sm">Sign in to edit your profile.</p>
          )}

          {tab === "theme" && (
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => { onTheme(t.id); applyTheme(t.id); }}
                  className={`text-left glass-soft rounded-2xl p-3 transition ${theme === t.id ? "ring-2 ring-[var(--msg-accent)] glow-accent" : "hover:bg-white/10"}`}>
                  <div className="flex h-12 rounded-lg overflow-hidden mb-2">
                    {t.swatch.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}
                  </div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">{t.description}</div>
                </button>
              ))}
            </div>
          )}

          {tab === "backup" && (
            <div className="space-y-3">
              <div className="glass-soft rounded-2xl p-4 text-sm text-white/70">
                Cloud backup pulls your chats, messages and stories from the server. Local backup saves your notes and device settings.
              </div>
              <button onClick={async () => { setBusy(true); await downloadCloudBackup(); setBusy(false); flash("Cloud backup downloaded"); }}
                disabled={busy || !user}
                className="w-full bg-white text-black rounded-xl px-4 py-3 font-medium disabled:opacity-50">⬇  Export cloud backup</button>
              <button onClick={() => { downloadBackup(); flash("Notes backup downloaded"); }}
                className="w-full glass-soft rounded-xl px-4 py-3 hover:bg-white/10">⬇  Export notes backup</button>
              <button onClick={() => importRef.current?.click()} className="w-full glass-soft rounded-xl px-4 py-3 hover:bg-white/10">⬆  Import notes backup</button>
              <input ref={importRef} type="file" accept="application/json" hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  const r = await importBackup(f);
                  flash(r.ok ? "Restored — reopen the app to see changes." : `Failed: ${r.error}`);
                }} />
            </div>
          )}

          {tab === "account" && (
            user ? (
              <div className="space-y-3">
                <div className="glass-soft rounded-2xl p-4 flex items-center gap-3">
                  <Avatar profile={profile} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{profile?.display_name || user.email}</div>
                    <div className="text-xs text-white/50 truncate">{user.email}</div>
                  </div>
                </div>
                <button onClick={signOut} className="w-full glass-soft rounded-2xl px-4 py-3 hover:bg-white/10 text-red-300 flex items-center justify-center gap-2">
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={signInGoogle} disabled={busy}
                  className="w-full bg-white text-black rounded-2xl px-4 py-3 font-medium disabled:opacity-50">Continue with Google</button>
                <div className="flex items-center gap-3 text-xs text-white/40"><span className="flex-1 h-px bg-white/10" />or<span className="flex-1 h-px bg-white/10" /></div>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email"
                  className="w-full glass-soft rounded-xl px-4 py-3 outline-none placeholder:text-white/40" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password"
                  className="w-full glass-soft rounded-xl px-4 py-3 outline-none placeholder:text-white/40" />
                <button onClick={signInEmail} disabled={busy}
                  className="w-full bg-[var(--msg-accent)] text-[var(--msg-bg)] rounded-xl px-4 py-3 font-medium glow-accent disabled:opacity-50">
                  {authMode === "signin" ? "Sign in" : "Create account"}
                </button>
                <button onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
                  className="w-full text-xs text-white/60 hover:text-white py-1">
                  {authMode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
                </button>
              </div>
            )
          )}
        </div>

        {status && <div className="px-5 py-2 text-[12px] text-center text-[var(--msg-accent)] bg-black/40">{status}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs text-white/50">{label}</span>
      {children}
    </label>
  );
}
