import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { THEMES, ThemeId, applyTheme } from "@/lib/stealth/themes";
import { downloadBackup, importBackup } from "@/lib/stealth/backup";
import type { User } from "@supabase/supabase-js";

interface Props {
  open: boolean;
  onClose: () => void;
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
}

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function SettingsPanel({ open, onClose, theme, onTheme }: Props) {
  const [tab, setTab] = useState<"account" | "profile" | "theme" | "backup">("account");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({ display_name: "", avatar_url: "", bio: "" });
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url, bio").eq("id", user.id).maybeSingle()
      .then(({ data }) => data && setProfile({ display_name: data.display_name ?? "", avatar_url: data.avatar_url ?? "", bio: data.bio ?? "" }));
  }, [user]);

  const flash = (m: string) => { setStatus(m); setTimeout(() => setStatus(null), 2400); };

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
  const signOut = async () => { await supabase.auth.signOut(); flash("Signed out."); };

  const saveProfile = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, display_name: profile.display_name, avatar_url: profile.avatar_url, bio: profile.bio, theme,
    });
    setBusy(false);
    flash(error ? error.message : "Profile saved ✨");
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = await importBackup(f);
    flash(r.ok ? "Restored — refresh to see changes." : `Failed: ${r.error}`);
    e.target.value = "";
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-end sm:place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90vh] glass-strong rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col text-white animate-in slide-in-from-bottom-8 duration-300">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          <button onClick={onClose} className="ml-auto size-8 grid place-items-center rounded-full hover:bg-white/10">✕</button>
        </div>

        <nav className="flex gap-1 px-3 py-2 border-b border-white/10 text-[13px]">
          {[["account","Account"],["profile","Profile"],["theme","Theme"],["backup","Backup"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)}
              className={`px-3 py-1.5 rounded-full transition ${tab === k ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "account" && (
            user ? (
              <div className="space-y-3">
                <div className="glass-soft rounded-2xl p-4 flex items-center gap-3">
                  <div className="size-12 rounded-full bg-gradient-to-br from-white/30 to-white/10 grid place-items-center text-xl">
                    {profile.avatar_url ? <img src={profile.avatar_url} className="size-full rounded-full object-cover" alt="" /> : "👤"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{profile.display_name || user.email}</div>
                    <div className="text-xs text-white/50 truncate">{user.email}</div>
                  </div>
                </div>
                <button onClick={signOut} className="w-full glass-soft rounded-2xl px-4 py-3 hover:bg-white/10 text-red-300">Sign out</button>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={signInGoogle} disabled={busy}
                  className="w-full bg-white text-black rounded-2xl px-4 py-3 font-medium flex items-center justify-center gap-2 hover:bg-white/90 disabled:opacity-50">
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 2.9l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8.9 20-20 0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.2-7.2 2.2-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.3 39.6 16 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z"/></svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 text-xs text-white/40"><span className="flex-1 h-px bg-white/10" />or<span className="flex-1 h-px bg-white/10" /></div>
                <div className="space-y-2">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email"
                    className="w-full glass-soft rounded-xl px-4 py-3 outline-none placeholder:text-white/40" />
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password"
                    className="w-full glass-soft rounded-xl px-4 py-3 outline-none placeholder:text-white/40" />
                  <button onClick={signInEmail} disabled={busy}
                    className="w-full bg-[var(--msg-accent)] text-black rounded-xl px-4 py-3 font-medium disabled:opacity-50 glow-accent">
                    {authMode === "signin" ? "Sign in" : "Create account"}
                  </button>
                  <button onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
                    className="w-full text-xs text-white/60 hover:text-white py-1">
                    {authMode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
                  </button>
                </div>
              </div>
            )
          )}

          {tab === "profile" && (
            user ? (
              <div className="space-y-3">
                <label className="block text-xs text-white/50">Display name</label>
                <input value={profile.display_name ?? ""} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  className="w-full glass-soft rounded-xl px-4 py-3 outline-none" />
                <label className="block text-xs text-white/50">Avatar URL</label>
                <input value={profile.avatar_url ?? ""} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                  placeholder="https://…" className="w-full glass-soft rounded-xl px-4 py-3 outline-none placeholder:text-white/40" />
                <label className="block text-xs text-white/50">Bio</label>
                <textarea value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3}
                  className="w-full glass-soft rounded-xl px-4 py-3 outline-none resize-none" />
                <button onClick={saveProfile} disabled={busy}
                  className="w-full bg-[var(--msg-accent)] text-black rounded-xl px-4 py-3 font-medium glow-accent disabled:opacity-50">
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
                Export everything (notes, contacts, messages, stories) as one JSON file. Restore by importing later or on another device.
              </div>
              <button onClick={downloadBackup} className="w-full bg-white text-black rounded-xl px-4 py-3 font-medium">⬇  Export backup</button>
              <button onClick={() => importRef.current?.click()} className="w-full glass-soft rounded-xl px-4 py-3 hover:bg-white/10">⬆  Import backup</button>
              <input ref={importRef} type="file" accept="application/json" hidden onChange={onImport} />
            </div>
          )}
        </div>

        {status && <div className="px-5 py-2 text-[12px] text-center text-[var(--msg-accent)] bg-black/40">{status}</div>}
      </div>
    </div>
  );
}
