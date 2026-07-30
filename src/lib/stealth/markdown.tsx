import type { ReactNode } from "react";

/* Tiny, dependency-free markdown renderer tuned for the notes layer.
   Supports: headings, bold/italic/strike/highlight, inline + fenced code,
   bullets, ordered lists, task checkboxes, quotes, dividers and links. */

let key = 0;
const k = () => `md-${key++}`;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(==[^=]+==)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("`"))
      out.push(
        <code key={k()} className="font-mono text-[0.85em] rounded-md px-1.5 py-0.5 bg-secondary text-primary">
          {t.slice(1, -1)}
        </code>,
      );
    else if (t.startsWith("**")) out.push(<strong key={k()} className="font-semibold">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("~~")) out.push(<s key={k()} className="opacity-60">{t.slice(2, -2)}</s>);
    else if (t.startsWith("==")) out.push(<mark key={k()} className="rounded px-1 bg-accent/50 text-accent-foreground">{t.slice(2, -2)}</mark>);
    else if (t.startsWith("[")) {
      const label = t.slice(1, t.indexOf("]"));
      const href = t.slice(t.indexOf("](") + 2, -1);
      out.push(
        <a key={k()} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
          {label}
        </a>,
      );
    } else out.push(<em key={k()} className="italic">{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(src: string): ReactNode {
  key = 0;
  const lines = src.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={k()} className="my-3 overflow-x-auto rounded-xl bg-foreground/[0.045] hairline p-3 text-[13px] leading-relaxed">
          {lang && <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{lang}</span>}
          <code className="font-mono whitespace-pre">{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={k()} className="my-5 border-0 h-px bg-border" />);
      i++;
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const sizes = ["text-2xl", "text-xl", "text-lg", "text-base"];
      blocks.push(
        <p key={k()} className={`font-display font-semibold mt-4 mb-1.5 ${sizes[level - 1]}`}>
          {inline(h[2])}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={k()} className="my-3 border-l-2 border-accent pl-3 italic text-muted-foreground">
          {inline(buf.join(" "))}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const items: { done: boolean; text: string }[] = [];
      while (i < lines.length && /^\s*[-*]\s+\[[ xX]\]\s+/.test(lines[i])) {
        const mm = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(lines[i++])!;
        items.push({ done: mm[1].toLowerCase() === "x", text: mm[2] });
      }
      blocks.push(
        <ul key={k()} className="my-2 space-y-1.5">
          {items.map((it) => (
            <li key={k()} className="flex items-start gap-2.5">
              <span
                className={`mt-[3px] size-4 shrink-0 rounded-[6px] grid place-items-center text-[10px] ${
                  it.done ? "bg-primary text-primary-foreground" : "hairline"
                }`}
              >
                {it.done ? "✓" : ""}
              </span>
              <span className={it.done ? "line-through text-muted-foreground" : ""}>{inline(it.text)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]) && !/\[[ xX]\]/.test(lines[i]))
        items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(
        <ul key={k()} className="my-2 space-y-1 pl-1">
          {items.map((t) => (
            <li key={k()} className="flex gap-2.5">
              <span className="text-accent mt-[2px]">◆</span>
              <span>{inline(t)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      blocks.push(
        <ol key={k()} className="my-2 space-y-1">
          {items.map((t, n) => (
            <li key={k()} className="flex gap-2.5">
              <span className="font-display text-accent tabular-nums">{n + 1}.</span>
              <span>{inline(t)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*>#]|\d+\.|```)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(
      <p key={k()} className="my-2 leading-[1.75]">
        {inline(buf.join("\n"))}
      </p>,
    );
  }

  return <div className="text-[15px]">{blocks}</div>;
}

export function looksLikeHtml(src: string) {
  const s = src.trim();
  return /^<!doctype\s+html/i.test(s) || /^<html[\s>]/i.test(s) || /<(body|main|section|article|div|style|h1|p|button|canvas|svg)[\s>]/i.test(s);
}

export function renderNotePreview(src: string): ReactNode {
  const body = src.trim();
  if (!body) return renderMarkdown("_Nothing written yet._");
  if (!looksLikeHtml(body)) return renderMarkdown(src);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-secondary px-3 py-2 text-[11px] text-muted-foreground">
        <span>HTML preview</span>
        <span>Scripts blocked</span>
      </div>
      <iframe
        title="HTML note preview"
        sandbox="allow-forms allow-popups allow-modals"
        srcDoc={sanitizeHtmlPreview(body)}
        className="h-[60vh] w-full rounded-2xl border border-border bg-white shadow-inner"
      />
    </div>
  );
}

function sanitizeHtmlPreview(src: string) {
  const cleaned = src
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  if (/^<!doctype\s+html/i.test(cleaned) || /^<html[\s>]/i.test(cleaned)) return cleaned;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{font-family:Inter,ui-sans-serif,system-ui;background:#fff;color:#111}body{margin:0;padding:20px;min-height:100vh;box-sizing:border-box}*{box-sizing:border-box}img,video,svg,canvas{max-width:100%;height:auto}button,input,textarea,select{font:inherit}</style></head><body>${cleaned}</body></html>`;
}

export function noteStats(body: string) {
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  return {
    words,
    chars: body.length,
    minutes: Math.max(1, Math.round(words / 200)),
    tasks: (body.match(/^\s*[-*]\s+\[[ xX]\]/gm) ?? []).length,
    done: (body.match(/^\s*[-*]\s+\[[xX]\]/gm) ?? []).length,
  };
}
