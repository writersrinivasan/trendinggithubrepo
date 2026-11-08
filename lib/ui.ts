/** Categorical palette (validated dark-surface steps). Assign in this fixed order, never cycle. */
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const OTHER = "#6b6a64";

export const fmt = (n: number | undefined | null): string => {
  if (n === undefined || n === null || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${Math.round(n / 1000)}k`;
  if (a >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
};

export const ago = (iso?: string) => {
  if (!iso) return "–";
  const d = (Date.now() - Date.parse(iso)) / 86_400_000;
  if (d < 1) return `${Math.max(1, Math.round(d * 24))}h ago`;
  if (d < 60) return `${Math.round(d)}d ago`;
  if (d < 730) return `${Math.round(d / 30)}mo ago`;
  return `${(d / 365).toFixed(1)}y ago`;
};

export const ageLabel = (days?: number) => (days === undefined ? "–" : days < 60 ? `${days}d` : days < 730 ? `${Math.round(days / 30)}mo` : `${(days / 365).toFixed(1)}y`);

/** Fold a count map into top-N + "Other" so we never exceed the palette. */
export function topN(counts: Map<string, number>, n = 7) {
  // A real "Other" bucket (e.g. the "Other" category) merges with the overflow, so keys stay unique.
  const existingOther = counts.get("Other") ?? 0;
  const sorted = [...counts.entries()].filter(([k]) => k !== "Other").sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, n).map(([name, value]) => ({ name, value }));
  const rest = sorted.slice(n).reduce((s, [, v]) => s + v, 0) + existingOther;
  return rest ? [...head, { name: "Other", value: rest }] : head;
}

export const count = <T,>(items: T[], key: (t: T) => string | string[] | null | undefined) => {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    for (const v of Array.isArray(k) ? k : k ? [k] : []) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
};

export const LANGUAGES = ["", "python", "typescript", "javascript", "rust", "go", "java", "c++", "c", "c#", "swift", "kotlin", "ruby", "php", "dart", "zig", "shell", "jupyter-notebook", "html", "vue"];

export const AGENTS = [
  { id: "scout", label: "Scout", role: "Scrapes github.com/trending live", color: SERIES[0] },
  { id: "enricher", label: "Enricher", role: "GitHub API, READMEs, languages", color: SERIES[2] },
  { id: "quant", label: "Quant", role: "Momentum, health & velocity scores", color: SERIES[3] },
  { id: "analyst", label: "Analyst ×N", role: "Groq LLM: why it's trending, models, stack", color: SERIES[4] },
  { id: "strategist", label: "Strategist", role: "Themes, predictions, top pick", color: SERIES[6] },
] as const;
