import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Lock, Loader2, AtSign, Sparkles } from "lucide-react";

interface Props {
  onReady: (userId: string) => void;
  onExit: () => void;
}

/** Sign-in / sign-up gate for the hidden messenger layer. */
export function AuthGate({ onReady, onExit }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [needsHandle, setNeedsHandle] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive || !data.user) return;
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
      if (!alive) return;
      if (p?.username) onReady(data.user.id);
      else setNeedsHandle(data.user.id);
    });
    return () => { alive = false; };
  }, [onReady]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };

  const claimHandle = async (userId: string) => {
    const handle = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (handle.length < 3) return flash("Handle needs 3+ letters, numbers or _");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ username: handle }).eq("id", userId);
    setBusy(false);
    if (error) return flash(error.message.includes("duplicate") ? "That handle is taken" : error.message);
    onReady(userId);
  };

  const submit = async () => {
    if (needsHandle) return claimHandle(needsHandle);
    if (!email || !password) return flash("Email and password required");
    setBusy(true);
    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return flash(error.message);
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
      if (p?.username) onReady(data.user.id);
      else setNeedsHandle(data.user.id);
    } else {
      const handle = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (handle.length < 3) { setBusy(false); return flash("Pick a handle (3+ chars)"); }
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { username: handle } },
      });
      setBusy(false);
      if (error) return flash(error.message);
      if (data.session && data.user) await claimHandle(data.user.id);
      else flash("Check your inbox to confirm, then sign in.");
    }
  };

  const google = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (r.error) flash("Google sign-in failed");
  };

  return (
    <div className="h-dvh w-full aurora-bg text-white grid place-items-center px-5">
      <div className="w-full max-w-sm glass-strong rounded-[28px] p-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="mx-auto size-14 rounded-2xl glass grid place-items-center glow-accent">
            <Lock className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Secure Channel</h1>
          <p className="text-xs text-[var(--msg-muted)]">
            {needsHandle ? "Choose your handle so friends can find you" : "Sign in to sync your encrypted messages"}
          </p>
        </div>

        {needsHandle ? (
          <HandleField value={username} onChange={setUsername} />
        ) : (
          <>
            {mode === "signup" && <HandleField value={username} onChange={setUsername} />}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email"
              className="w-full glass-soft rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-white/40" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full glass-soft rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-white/40" />
          </>
        )}

        <button onClick={submit} disabled={busy}
          className="w-full py-3 rounded-2xl bg-[var(--msg-accent)] text-[var(--msg-bg)] font-semibold text-sm active:scale-[0.98] transition glow-accent disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {needsHandle ? "Claim handle" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {!needsHandle && (
          <>
            <div className="flex items-center gap-3 text-[11px] text-white/30">
              <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
            </div>
            <button onClick={google} disabled={busy}
              className="w-full py-3 rounded-2xl glass text-sm font-medium active:scale-[0.98] transition flex items-center justify-center gap-2">
              <Sparkles className="size-4" /> Continue with Google
            </button>
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-xs text-[var(--msg-muted)] hover:text-white">
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </>
        )}

        <button onClick={onExit} className="w-full text-xs text-white/30 hover:text-white/60">Back to notes</button>
        {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
      </div>
    </div>
  );
}

function HandleField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/40" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="yourhandle"
        className="w-full glass-soft rounded-2xl pl-10 pr-4 py-3 text-sm outline-none placeholder:text-white/40" />
    </div>
  );
}
