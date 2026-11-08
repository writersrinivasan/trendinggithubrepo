"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitBranch as Github, KeyRound, RefreshCw, Radar, LayoutGrid, Table2, AlertTriangle } from "lucide-react";
import type { Dataset, LogEntry, Repo, Since } from "@/lib/types";
import { LANGUAGES, SERIES, ago, count, fmt, topN, ageLabel } from "@/lib/ui";
import { Pipeline, Kpis, InsightsPanel, SkeletonDash, type AgentStatus } from "@/components/Panels";
import { StarsGainedChart, DonutChart, MomentumMap, AccelerationChart, HealthRadar, HypeSubstance, CountBars, AgeChart, TopicCloud } from "@/components/Charts";
import { RepoCard, RepoDrawer } from "@/components/RepoViews";
import { ChatPanel, SettingsDialog, keyHeaders, useKeys } from "@/components/Assist";

const PERIOD_WORD: Record<Since, string> = { daily: "today", weekly: "this week", monthly: "this month" };
const ORDER = ["scout", "enricher", "quant", "analyst", "strategist"];

export default function Home() {
  const { keys, save, loaded } = useKeys();
  const [since, setSince] = useState<Since>("daily");
  const [language, setLanguage] = useState("");
  const [data, setData] = useState<Dataset | null>(null);
  const [status, setStatus] = useState<Record<string, AgentStatus>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [live, setLive] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<Repo | null>(null);
  const [catFilter, setCatFilter] = useState<string>("All");
  const [sort, setSort] = useState<"rank" | "starsPeriod" | "acceleration" | "health" | "stars">("rank");
  const [view, setView] = useState<"cards" | "table">("cards");
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (opts?: { since?: Since; language?: string; keys?: typeof keys }) => {
    const k = opts?.keys ?? keys;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRunning(true);
    setError(null);
    setLogs([]);
    setStatus({ scout: "running" });
    setLive("Starting agents…");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", ...keyHeaders(k) },
        body: JSON.stringify({ since: opts?.since ?? since, language: opts?.language ?? language, model: k.model || undefined }),
        signal: ctrl.signal,
        cache: "no-store",
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const event = part.match(/^event: (.*)$/m)?.[1];
          const raw = part.match(/^data: (.*)$/m)?.[1];
          if (!event || !raw) continue;
          const payload = JSON.parse(raw);
          if (event === "progress") {
            setLive(payload.message);
            setStatus((s) => ({ ...s, [payload.agent]: "running" }));
          } else if (event === "step") {
            const node = payload.node === "heuristic" ? "analyst" : payload.node;
            const warn = (payload.logs as LogEntry[]).some((l) => l.level === "warn");
            setLogs((l) => [...l, ...payload.logs]);
            setLive(payload.logs.at(-1)?.message ?? "");
            setStatus((s) => {
              const next = { ...s, [node]: warn || s[node] === "warn" ? "warn" : "done" } as Record<string, AgentStatus>;
              const after = ORDER[ORDER.indexOf(node) + 1];
              if (after && !next[after]) next[after] = "running";
              return next;
            });
          } else if (event === "done") {
            setData(payload);
            setLive(`Live data · fetched ${new Date(payload.meta.fetchedAt).toLocaleTimeString()} · ${(payload.meta.durationMs / 1000).toFixed(1)}s`);
          } else if (event === "error") {
            setError(payload.message);
            setStatus((s) => Object.fromEntries(Object.entries(s).map(([a, v]) => [a, v === "running" ? "warn" : v])));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (abort.current === ctrl) setRunning(false);
    }
  }, [keys, since, language]);

  // Every page load is a fresh, live run.
  useEffect(() => { if (loaded) run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [loaded]);

  const repos = useMemo(() => data?.repos ?? [], [data]);
  const periodWord = PERIOD_WORD[(data?.meta.since ?? since) as Since];
  const categories = useMemo(() => topN(count(repos, (r) => r.ai?.category), 7), [repos]);
  const languages = useMemo(() => topN(count(repos, (r) => r.language ?? "Unknown"), 7), [repos]);
  const licenses = useMemo(() => topN(count(repos, (r) => (r.details ? r.details.license ?? "None" : "Unknown")), 5), [repos]);
  const modelCounts = useMemo(() => count(repos, (r) => r.ai?.aiModels ?? []), [repos]);
  const fwCounts = useMemo(() => count(repos, (r) => [...new Set([...(r.detectedFrameworks ?? []), ...(r.ai?.techStack ?? [])])]), [repos]);

  const shown = useMemo(() => {
    const list = repos.filter((r) => catFilter === "All" || r.ai?.category === catFilter);
    const key = (r: Repo) => ({ rank: -r.rank, starsPeriod: r.starsPeriod, acceleration: r.metrics?.acceleration ?? 0, health: r.metrics?.healthScore ?? 0, stars: r.stars })[sort];
    return [...list].sort((a, b) => key(b) - key(a));
  }, [repos, catFilter, sort]);

  const pick = (name: string) => setSelected(repos.find((r) => r.fullName.toLowerCase() === name?.toLowerCase() || r.name.toLowerCase() === name?.toLowerCase()) ?? null);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3987e5] via-[#d55181] to-[#c98500] shadow-lg shadow-[#d55181]/30">
          <Radar className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl"><span className="gradient-text">Trending Radar</span></h1>
          <p className="text-xs text-muted">Live GitHub trending intelligence · LangGraph multi-agent · Groq</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-ring bg-surface p-0.5 text-xs">
            {(["daily", "weekly", "monthly"] as Since[]).map((s) => (
              <button key={s} disabled={running} onClick={() => { setSince(s); run({ since: s }); }} className={`rounded-lg px-3 py-1.5 capitalize transition ${since === s ? "bg-gradient-to-r from-[#3987e5] to-[#9085e9] text-white" : "text-ink-2 hover:text-ink"}`}>{s}</button>
            ))}
          </div>
          <select disabled={running} value={language} onChange={(e) => { setLanguage(e.target.value); run({ language: e.target.value }); }} className="rounded-xl border border-ring bg-surface px-3 py-2 text-xs text-ink-2 outline-none">
            {LANGUAGES.map((l) => <option key={l} value={l}>{l ? l : "All languages"}</option>)}
          </select>
          <button onClick={() => run()} disabled={running} className="flex items-center gap-1.5 rounded-xl border border-ring bg-surface px-3 py-2 text-xs hover:bg-surface-2 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} /> {running ? "Running" : "Refresh"}
          </button>
          <button onClick={() => setSettings(true)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${keys.groq ? "border border-ring bg-surface text-ink-2" : "bg-gradient-to-r from-[#c98500] to-[#d95926] text-white"}`}>
            <KeyRound className="h-3.5 w-3.5" /> {keys.groq ? "Keys ✓" : "Add Groq key"}
          </button>
        </div>
      </header>

      <div className="mt-5 space-y-5">
        <Pipeline status={status} logs={logs} live={live} />

        {error && (
          <div className="card flex items-center gap-2 border-[#d03b3b]/50 p-4 text-sm text-[#e66767]"><AlertTriangle className="h-4 w-4" /> {error}</div>
        )}

        {!data && running && <SkeletonDash />}

        {data && (
          <div className={`space-y-5 transition-opacity ${running ? "opacity-50" : ""}`}>
            {repos.some((r) => !r.details) && (
              <div className="card flex flex-wrap items-center gap-2 border-[#fab219]/40 p-4 text-xs text-ink-2">
                <AlertTriangle className="h-4 w-4 text-[#fab219]" aria-label="warning" />
                <b className="text-ink">GitHub API limit reached.</b> {repos.filter((r) => !r.details).length} repos are missing age, license, topics and health data. Unauthenticated access allows 60 requests/hour.
                <button onClick={() => setSettings(true)} className="font-semibold text-[#6aa8ff] hover:underline">Add a GitHub token</button>
              </div>
            )}
            {data.insights && <InsightsPanel insights={data.insights} onPick={pick} />}
            <Kpis data={data} periodWord={periodWord} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <StarsGainedChart repos={repos} periodWord={periodWord} />
              <MomentumMap repos={repos} periodWord={periodWord} />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <DonutChart title="Category mix" subtitle="Assigned by the Analyst agent" data={categories} accent={SERIES[4]} />
              <DonutChart title="Primary languages" subtitle="From the trending list" data={languages} accent={SERIES[0]} />
              <DonutChart title="Licenses" subtitle="Open-source license by repo" data={licenses} accent={SERIES[2]} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <AccelerationChart repos={repos} />
              <HealthRadar repos={repos} />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <CountBars title="AI models in use" subtitle="Models that repos use or support, from the LLM plus README scan" counts={modelCounts} color={SERIES[4]} empty="No AI models detected in this set." />
              <CountBars title="Frameworks & tech stack" subtitle="Libraries and tools that recur across repos" counts={fwCounts} color={SERIES[2]} empty="No frameworks detected." />
              <AgeChart repos={repos} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <HypeSubstance repos={repos} />
              <TopicCloud repos={repos} />
            </div>

            {/* Repo explorer */}
            <section>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-lg font-bold">Repo explorer</h2>
                {["All", ...categories.map((c) => c.name).filter((c) => c !== "Other")].map((c) => (
                  <button key={c} onClick={() => setCatFilter(c)} className={`chip transition ${catFilter === c ? "!border-[#3987e5] !text-ink" : "hover:text-ink"}`}>{c}</button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-ring bg-surface px-2 py-1.5 text-xs text-ink-2 outline-none">
                    <option value="rank">Sort: trending rank</option>
                    <option value="starsPeriod">Sort: stars gained</option>
                    <option value="acceleration">Sort: acceleration</option>
                    <option value="health">Sort: health score</option>
                    <option value="stars">Sort: total stars</option>
                  </select>
                  <div className="flex rounded-lg border border-ring p-0.5">
                    <button onClick={() => setView("cards")} className={`rounded-md p-1 ${view === "cards" ? "bg-surface-2" : ""}`} aria-label="Cards"><LayoutGrid className="h-4 w-4" /></button>
                    <button onClick={() => setView("table")} className={`rounded-md p-1 ${view === "table" ? "bg-surface-2" : ""}`} aria-label="Table"><Table2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>

              {view === "cards" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {shown.map((r) => <RepoCard key={r.fullName} repo={r} periodWord={periodWord} onOpen={() => setSelected(r)} />)}
                </div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="tabular w-full min-w-[900px] text-left text-xs">
                    <thead className="text-muted">
                      <tr className="border-b border-ring">
                        {["#", "Repo", "Category", "Lang", `+Stars ${periodWord}`, "Stars", "Forks", "Accel.", "Age", "Health", "Hype", "Substance", "Last push", "Models"].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.fullName} onClick={() => setSelected(r)} className="cursor-pointer border-b border-ring/50 text-ink-2 hover:bg-surface-2">
                          <td className="px-3 py-2">{r.rank}</td>
                          <td className="px-3 py-2 font-medium text-ink">{r.fullName}</td>
                          <td className="px-3 py-2">{r.ai?.category}</td>
                          <td className="px-3 py-2">{r.language ?? "–"}</td>
                          <td className="px-3 py-2 text-[#6aa8ff]">+{fmt(r.starsPeriod)}</td>
                          <td className="px-3 py-2">{fmt(r.stars)}</td>
                          <td className="px-3 py-2">{fmt(r.forks)}</td>
                          <td className="px-3 py-2">{r.metrics?.acceleration}×</td>
                          <td className="px-3 py-2">{ageLabel(r.metrics?.ageDays)}</td>
                          <td className="px-3 py-2">{r.metrics?.healthScore}</td>
                          <td className="px-3 py-2">{r.ai?.hypeScore}</td>
                          <td className="px-3 py-2">{r.ai?.substanceScore}</td>
                          <td className="px-3 py-2">{ago(r.details?.pushedAt)}</td>
                          <td className="px-3 py-2">{r.ai?.aiModels.join(", ") || "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <footer className="flex flex-wrap items-center gap-2 pt-4 text-[11px] text-muted">
              <Github className="h-3.5 w-3.5" />
              Source: github.com/trending ({data.meta.since}{data.meta.language ? `, ${data.meta.language}` : ""}) scraped live at {new Date(data.meta.fetchedAt).toLocaleString()} ·
              GitHub API {data.meta.deepMode ? "deep" : "light"} mode{data.meta.rateRemaining !== null ? ` (${data.meta.rateRemaining} calls left)` : ""} ·
              Analysis: {data.insights?.source === "groq" ? `Groq ${data.meta.model ?? "default model"}` : "rule-based (add a Groq key for LLM analysis)"}
            </footer>
          </div>
        )}
      </div>

      <RepoDrawer repo={selected} periodWord={periodWord} onClose={() => setSelected(null)} />
      <SettingsDialog open={settings} keys={keys} onClose={() => setSettings(false)} onSave={(k) => { save(k); run({ keys: k }); }} />
      <ChatPanel data={data} keys={keys} onNeedKey={() => setSettings(true)} />
    </main>
  );
}
