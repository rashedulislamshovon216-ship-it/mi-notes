import { useEffect, useState } from "react";
import { CloudProfile, displayNameOf, resolveMedia } from "@/lib/stealth/cloud";

const GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-pink-500 to-rose-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-indigo-500 to-blue-500",
];

export function gradientFor(id?: string | null) {
  if (!id) return GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function useSignedUrl(ref: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!ref) { setUrl(null); return; }
    resolveMedia(ref).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [ref]);
  return url;
}

export function Avatar({
  profile, size = 48, online, nickname, ring,
}: {
  profile: CloudProfile | null;
  size?: number;
  online?: boolean;
  nickname?: string | null;
  ring?: boolean;
}) {
  const url = useSignedUrl(profile?.avatar_url ?? null);
  const name = displayNameOf(profile, nickname);
  const initial = name.replace("@", "").charAt(0).toUpperCase() || "?";
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${gradientFor(profile?.id)} shadow-md ${ring ? "ring-2 ring-[var(--msg-accent)]/60" : ""}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        <span className="font-semibold text-white" style={{ fontSize: size * 0.4 }}>{initial}</span>
      )}
      {profile?.status_emoji && (
        <span className="absolute -bottom-1 -right-1 text-xs drop-shadow">{profile.status_emoji}</span>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 border-2 border-[var(--msg-bg)]" />
      )}
    </span>
  );
}

export function CloudMedia({
  refPath, kind, className, onClick,
}: {
  refPath: string | null;
  kind: "image" | "video" | "audio";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const url = useSignedUrl(refPath);
  if (!url) return <div className={`${className} bg-white/5 animate-pulse rounded-xl min-h-24 min-w-40`} />;
  if (kind === "image") return <img src={url} alt="" className={className} onClick={onClick} loading="lazy" />;
  if (kind === "video") return <video src={url} controls className={className} />;
  return <audio src={url} controls className={className} />;
}
