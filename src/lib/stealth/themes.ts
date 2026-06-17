export type ThemeId = "noir" | "aurora" | "sunset" | "mint";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  swatch: string[];
  description: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "noir",   name: "Mono Noir",     swatch: ["#000000", "#111111", "#e5e5e5", "#ffffff"], description: "Pure black, silver edges." },
  { id: "aurora", name: "Aurora Glass",  swatch: ["#0a0a1a", "#1a1240", "#7c3aed", "#22d3ee"], description: "Violet nebula + cyan glow." },
  { id: "sunset", name: "Sunset Liquid", swatch: ["#1a0a14", "#3d1530", "#f97316", "#fb7185"], description: "Warm magenta dusk." },
  { id: "mint",   name: "Mint Frost",    swatch: ["#0a1612", "#0f2e26", "#34d399", "#a7f3d0"], description: "Cool emerald frost." },
];

const KEY = "qn.theme.v1";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "noir";
  const v = localStorage.getItem(KEY) as ThemeId | null;
  return v && THEMES.some((t) => t.id === v) ? v : "noir";
}

export function applyTheme(t: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(KEY, t);
}
