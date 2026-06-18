import { useEffect, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, ScreenShare } from "lucide-react";
import type { Contact } from "@/lib/stealth/storage";

type Mode = "voice" | "video";

interface Props {
  contact: Contact;
  mode: Mode;
  onClose: () => void;
}

export function CallModal({ contact, mode, onClose }: Props) {
  const [phase, setPhase] = useState<"ringing" | "live">("ringing");
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(mode === "video");
  const [speaker, setSpeaker] = useState(true);

  useEffect(() => {
    const a = setTimeout(() => setPhase("live"), 2200);
    return () => clearTimeout(a);
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const time = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] aurora-bg text-white flex flex-col">
      {/* peer view */}
      <div className="flex-1 relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${contact.color} opacity-40 blur-3xl`} />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative">
            {phase === "ringing" && (
              <>
                <span className="absolute inset-0 rounded-full bg-white/20 pulse-ring" />
                <span className="absolute inset-0 rounded-full bg-white/15 pulse-ring" style={{ animationDelay: "0.4s" }} />
              </>
            )}
            <div className={`size-40 rounded-full bg-gradient-to-br ${contact.color} grid place-items-center text-7xl shadow-2xl ring-4 ring-white/10 relative z-10`}>
              {contact.avatar}
            </div>
          </div>
        </div>
        <div className="absolute top-0 inset-x-0 pt-10 text-center">
          <p className="text-[28px] font-medium tracking-tight">{contact.name}</p>
          <p className="text-sm text-white/70 mt-1">
            {phase === "ringing" ? (mode === "video" ? "Ringing… video call" : "Ringing…") : time}
          </p>
        </div>
        {/* self preview */}
        {mode === "video" && (
          <div className="absolute top-6 right-6 size-28 rounded-2xl glass overflow-hidden grid place-items-center">
            {camOn ? <span className="text-3xl">🤳</span> : <VideoOff className="size-7 text-white/60" />}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="glass-strong px-6 pt-6 pb-10 rounded-t-3xl">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <CallBtn active={!muted} onClick={() => setMuted((m) => !m)}>
            {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
          </CallBtn>
          {mode === "video" && (
            <CallBtn active={camOn} onClick={() => setCamOn((c) => !c)}>
              {camOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
            </CallBtn>
          )}
          <CallBtn active={speaker} onClick={() => setSpeaker((s) => !s)}>
            <Volume2 className="size-6" />
          </CallBtn>
          <CallBtn active={false}>
            <ScreenShare className="size-6" />
          </CallBtn>
          <button
            onClick={onClose}
            className="size-16 rounded-full bg-red-500 hover:bg-red-600 grid place-items-center shadow-xl shadow-red-500/40 transition active:scale-95"
            aria-label="End call"
          >
            <PhoneOff className="size-7 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CallBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`size-14 rounded-full grid place-items-center transition active:scale-95 ${
        active ? "bg-white/15 text-white" : "bg-white text-black"
      }`}
    >
      {children}
    </button>
  );
}
