import { useRef, useState } from "react";
import { Type, Palette, Send, X } from "lucide-react";

interface Props {
  file: File;
  onCancel: () => void;
  onPost: (dataUrl: string, mediaType: "image" | "video") => void;
}

const BG_TINTS = ["transparent", "#000000aa", "#ffffff66", "#ff385c66", "#7c3aedaa", "#22d3eeaa"];
const TEXT_COLORS = ["#ffffff", "#000000", "#fb7185", "#7c3aed", "#22d3ee", "#facc15"];

export function StoryEditor({ file, onCancel, onPost }: Props) {
  const isVideo = file.type.startsWith("video");
  const [url] = useState(() => URL.createObjectURL(file));
  const [caption, setCaption] = useState("");
  const [color, setColor] = useState(TEXT_COLORS[0]);
  const [tint, setTint] = useState(BG_TINTS[0]);
  const [showText, setShowText] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const post = async () => {
    if (isVideo) {
      // videos posted as-is (no caption baked into the file)
      const blob = await fetch(url).then((r) => r.blob());
      const reader = new FileReader();
      reader.onload = () => onPost(reader.result as string, "video");
      reader.readAsDataURL(blob);
      return;
    }
    // bake the caption + tint into the image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = canvasRef.current ?? document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      if (tint !== "transparent") {
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      if (caption.trim()) {
        const fs = Math.round(c.width * 0.06);
        ctx.font = `600 ${fs}px ui-sans-serif, system-ui`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 12;
        const lines = wrap(ctx, caption, c.width * 0.85);
        lines.forEach((ln, i) => ctx.fillText(ln, c.width / 2, c.height * 0.78 + i * fs * 1.2));
      }
      onPost(c.toDataURL("image/jpeg", 0.9), "image");
    };
    img.src = url;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col text-white">
      {/* top bar */}
      <div className="absolute top-0 inset-x-0 z-10 p-4 flex items-center justify-between">
        <button onClick={onCancel} className="size-10 rounded-full glass grid place-items-center"><X className="size-5" /></button>
        <div className="flex items-center gap-2">
          {!isVideo && (
            <button onClick={() => setShowText((s) => !s)} className="size-10 rounded-full glass grid place-items-center"><Type className="size-5" /></button>
          )}
        </div>
      </div>

      {/* preview */}
      <div className="flex-1 relative grid place-items-center overflow-hidden">
        {isVideo
          ? <video src={url} autoPlay loop muted playsInline className="max-h-full max-w-full" />
          : <img src={url} alt="" className="max-h-full max-w-full" />}
        {tint !== "transparent" && !isVideo && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: tint }} />
        )}
        {caption && (
          <div
            className="absolute bottom-32 left-0 right-0 px-6 text-center text-2xl font-semibold drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] break-words"
            style={{ color }}
          >
            {caption}
          </div>
        )}
      </div>

      {/* text panel */}
      {showText && !isVideo && (
        <div className="absolute bottom-28 inset-x-0 px-4">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            className="w-full glass rounded-2xl px-4 py-3 text-base outline-none placeholder:text-white/40"
          />
          <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-none">
            <Palette className="size-5 text-white/60 shrink-0" />
            {TEXT_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className={`size-7 rounded-full shrink-0 border-2 ${color === c ? "border-white" : "border-white/20"}`}
                style={{ background: c }} />
            ))}
            <span className="w-3" />
            {BG_TINTS.map((b) => (
              <button key={b} onClick={() => setTint(b)}
                className={`size-7 rounded-full shrink-0 border-2 ${tint === b ? "border-white" : "border-white/20"}`}
                style={{ background: b === "transparent" ? "repeating-conic-gradient(#555 0 25%, #888 0 50%)" : b }} />
            ))}
          </div>
        </div>
      )}

      {/* send */}
      <div className="absolute bottom-6 inset-x-0 grid place-items-center">
        <button onClick={post}
          className="px-6 h-14 rounded-full bg-white text-black font-medium flex items-center gap-2 shadow-2xl active:scale-95 transition">
          <Send className="size-5" /> Post to story
        </button>
      </div>
      <canvas ref={canvasRef} hidden />
    </div>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else { cur = t; }
  }
  if (cur) lines.push(cur);
  return lines;
}
