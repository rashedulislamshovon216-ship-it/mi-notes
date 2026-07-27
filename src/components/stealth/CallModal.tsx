import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, RefreshCcw } from "lucide-react";
import {
  CallRow, CloudProfile, displayNameOf, patchCall, subscribeCall,
} from "@/lib/stealth/cloud";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

interface Props {
  call: CallRow;
  me: string;
  peer: CloudProfile | null;
  onClose: () => void;
}

/** Real peer-to-peer WebRTC call, signalled through the calls table. */
export function CallModal({ call, me, peer, onClose }: Props) {
  const isCaller = call.caller_id === me;
  const wantsVideo = call.kind === "video";
  const [status, setStatus] = useState<string>(call.status);
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(wantsVideo);
  const [speaker, setSpeaker] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const addedRemoteIce = useRef(new Set<string>());
  const answered = useRef(false);

  /* --- timer --- */
  useEffect(() => {
    if (status !== "active") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  /* --- media + peer connection --- */
  useEffect(() => {
    let cancelled = false;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = async (e) => {
      if (!e.candidate) return;
      const col = isCaller ? "caller_ice" : "callee_ice";
      const { data } = await supabase.from("calls").select(col).eq("id", call.id).maybeSingle();
      const cur = ((data as Record<string, unknown> | null)?.[col] as unknown[]) ?? [];
      await patchCall(call.id, { [col]: [...cur, e.candidate.toJSON()] } as never);
    };

    pc.ontrack = (e) => {
      if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("active");
      if (pc.connectionState === "failed") setError("Connection failed");
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo ? { facingMode: "user" } : false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await patchCall(call.id, { offer: { type: offer.type, sdp: offer.sdp } as never });
        } else {
          if (call.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(call.offer as RTCSessionDescriptionInit));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            answered.current = true;
            await patchCall(call.id, { answer: { type: ans.type, sdp: ans.sdp } as never, status: "active" });
            setStatus("active");
          }
        }
      } catch {
        setError("Camera / microphone permission denied");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      pc.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id]);

  /* --- signalling subscription --- */
  useEffect(() => {
    const ch = subscribeCall(call.id, async (row) => {
      const pc = pcRef.current;
      if (!pc) return;
      setStatus(row.status);
      if (row.status === "ended" || row.status === "declined") { onClose(); return; }

      if (isCaller && row.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(row.answer as RTCSessionDescriptionInit));
      }
      if (!isCaller && row.offer && !pc.currentRemoteDescription && !answered.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(row.offer as RTCSessionDescriptionInit));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        answered.current = true;
        await patchCall(call.id, { answer: { type: ans.type, sdp: ans.sdp } as never, status: "active" });
      }

      const remoteIce = (isCaller ? row.callee_ice : row.caller_ice) ?? [];
      for (const cand of remoteIce as RTCIceCandidateInit[]) {
        const key = JSON.stringify(cand);
        if (addedRemoteIce.current.has(key)) continue;
        addedRemoteIce.current.add(key);
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
      }
    });
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id]);

  const hangUp = async () => {
    await patchCall(call.id, { status: "ended", ended_at: new Date().toISOString() });
    onClose();
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };
  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };
  const flipCam = async () => {
    const pc = pcRef.current;
    const old = streamRef.current?.getVideoTracks()[0];
    if (!pc || !old) return;
    const facing = old.getSettings().facingMode === "environment" ? "user" : "environment";
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
    const next = s.getVideoTracks()[0];
    pc.getSenders().find((x) => x.track?.kind === "video")?.replaceTrack(next);
    old.stop();
    streamRef.current?.removeTrack(old);
    streamRef.current?.addTrack(next);
    if (localRef.current) localRef.current.srcObject = streamRef.current;
  };

  const name = displayNameOf(peer);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col">
      <div className="absolute inset-0 aurora-bg opacity-70" />

      {wantsVideo && (
        <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 size-full object-cover" />
      )}
      {!wantsVideo && <audio ref={remoteRef as never} autoPlay />}

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 px-6">
        {(!wantsVideo || status !== "active") && (
          <>
            <Avatar profile={peer} size={112} ring />
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
              <p className="text-sm text-[var(--msg-muted)] mt-1">
                {error ? error
                  : status === "active" ? `${mm}:${ss}`
                  : isCaller ? "Ringing…" : "Incoming call…"}
              </p>
            </div>
            {status !== "active" && !error && (
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {wantsVideo && (
        <video ref={localRef} autoPlay playsInline muted
          className="absolute top-5 right-4 w-28 aspect-[3/4] object-cover rounded-2xl border border-white/20 z-20 shadow-xl" />
      )}

      <div className="relative z-10 pb-10 px-6">
        {status === "active" && wantsVideo && (
          <p className="text-center text-sm text-white/80 mb-4">{mm}:{ss}</p>
        )}
        <div className="glass-strong rounded-[28px] px-4 py-4 flex items-center justify-around">
          <CallBtn active={micOn} onClick={toggleMic} label="Mic">
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </CallBtn>
          {wantsVideo && (
            <CallBtn active={camOn} onClick={toggleCam} label="Camera">
              {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </CallBtn>
          )}
          {wantsVideo && (
            <CallBtn active onClick={flipCam} label="Flip"><RefreshCcw className="size-5" /></CallBtn>
          )}
          <CallBtn active={speaker} onClick={() => setSpeaker((s) => !s)} label="Speaker">
            <Volume2 className="size-5" />
          </CallBtn>
          <button onClick={hangUp} aria-label="End call"
            className="size-14 rounded-full bg-red-500 grid place-items-center active:scale-95 transition shadow-lg shadow-red-500/30">
            <PhoneOff className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CallBtn({ children, active, onClick, label }: {
  children: React.ReactNode; active: boolean; onClick: () => void; label: string;
}) {
  return (
    <button aria-label={label} onClick={onClick}
      className={`size-12 rounded-full grid place-items-center transition active:scale-95 ${active ? "glass" : "bg-white text-black"}`}>
      {children}
    </button>
  );
}

/** Small incoming-call banner shown anywhere in the messenger. */
export function IncomingCall({ call, peer, onAccept, onDecline }: {
  call: CallRow; peer: CloudProfile | null; onAccept: () => void; onDecline: () => void;
}) {
  return (
    <div className="fixed top-3 inset-x-3 z-[75] glass-strong rounded-3xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-4">
      <Avatar profile={peer} size={44} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayNameOf(peer)}</p>
        <p className="text-xs text-[var(--msg-muted)]">Incoming {call.kind} call…</p>
      </div>
      <button onClick={onDecline} className="size-10 rounded-full bg-red-500 grid place-items-center"><PhoneOff className="size-4" /></button>
      <button onClick={onAccept} className="size-10 rounded-full bg-emerald-500 grid place-items-center">
        {call.kind === "video" ? <Video className="size-4" /> : <Mic className="size-4" />}
      </button>
    </div>
  );
}
