"use client";

import { Activity, Bot, Brain, Flame, GitFork, Rocket, Sparkles, Star, Target, TrendingUp, Trophy, Eye, Zap, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { Dataset, Insights, LogEntry, Repo } from "@/lib/types";
import { AGENTS, SERIES, fmt, ageLabel, count } from "@/lib/ui";

export type AgentStatus = "idle" | "running" | "done" | "warn";

/* --- Agent pipeline infographic ------------------------------------------- */
export function Pipeline({ status, logs, live }: { status: Record<string, AgentStatus>; logs: LogEntry[]; live: string }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-4 w-4 text-[#9085e9]" />
        <h3 className="text-sm font-semibold">LangGraph agent pipeline</h3>
        <span className="ml-auto truncate text-xs text-muted">{live}</span>
      </div>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {AGENTS.map((a, i) => {
          const s = status[a.id] ?? "idle";
          return (
            <li key={a.id} className="relative">
              <div
                className={`rounded-2xl border p-3 transition-all ${s === "running" ? "agent-running" : ""}`}
                style={{
                  borderColor: s === "idle" ? "var(--ring)" : a.color,
                  background: s === "idle" ? "var(--surface-2)" : `color-mix(in srgb, ${a.color} 14%, var(--surface))`,
                  ["--c" as string]: a.color,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: a.color }}>{i + 1}</span>
                  <span className="text-sm font-semibold">{a.label}</span>
                  <span className="ml-auto">
                    {s === "running" && <Loader2 className="h-4 w-4 animate-spin text-ink-2" />}
                    {s === "done" && <CheckCircle2 className="h-4 w-4 text-[#0ca30c]" aria-label="done" />}
                    {s === "warn" && <AlertTriangle className="h-4 w-4 text-[#fab219]" aria-label="warning" />}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted">{a.role}</p>
              </div>
              {i < AGENTS.length - 1 && <span className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-muted sm:block">›</span>}
            </li>
          );
        })}
      </ol>
      {logs.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-muted hover:text-ink-2">Agent log ({logs.length})</summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono">
            {logs.map((l, i) => (
              <li key={i} className={l.level === "warn" ? "text-[#fab219]" : l.level === "error" ? "text-[#e66767]" : "text-ink-2"}>
                <span className="text-muted">[{l.agent}]</span> {l.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/* --- KPI tiles ------------------------------------------------------------ */
function Tile({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 25%, transparent)` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </span>
        {label}
      </div>
      <div className="mt-2 truncate text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="truncate text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Kpis({ data, periodWord }: { data: Dataset; periodWord: string }) {
  const r = data.repos;
  const gained = r.reduce((s, x) => s + x.starsPeriod, 0);
  const totalStars = r.reduce((s, x) => s + x.stars, 0);
  const ai = r.filter((x) => x.ai?.isAI).length;
  const health = Math.round(r.reduce((s, x) => s + (x.metrics?.healthScore ?? 0), 0) / Math.max(1, r.length));
  const ages = r.filter((x) => x.details).map((x) => x.metrics?.ageDays ?? 0).sort((a, b) => a - b);
  const top = [...r].sort((a, b) => b.starsPeriod - a.starsPeriod)[0];
  const fastest = [...r].sort((a, b) => (b.metrics?.acceleration ?? 0) - (a.metrics?.acceleration ?? 0))[0];
  const langs = [...count(r, (x) => x.language).entries()].sort((a, b) => b[1] - a[1]);
  const known = r.filter((x) => x.details).length;
  const orgs = r.filter((x) => x.details?.ownerType === "Organization").length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile icon={Star} label={`Stars ${periodWord}`} value={`+${fmt(gained)}`} sub={`across ${r.length} repos`} color={SERIES[0]} />
      <Tile icon={Trophy} label="Top gainer" value={top?.name ?? "–"} sub={`+${fmt(top?.starsPeriod)} stars`} color={SERIES[3]} />
      <Tile icon={Zap} label="Fastest accelerating" value={fastest?.metrics?.acceleration ? fastest.name : "–"} sub={fastest?.metrics?.acceleration ? `${fastest.metrics.acceleration}× normal pace` : "needs GitHub API data"} color={SERIES[1]} />
      <Tile icon={Brain} label="AI-related" value={`${Math.round((ai / Math.max(1, r.length)) * 100)}%`} sub={`${ai} of ${r.length} repos`} color={SERIES[4]} />
      <Tile icon={Activity} label="Avg health score" value={`${health}/100`} sub="activity, docs, community" color={SERIES[2]} />
      <Tile icon={Rocket} label="Median repo age" value={ageLabel(ages[Math.floor(ages.length / 2)])} sub={`youngest ${ageLabel(ages[0])}`} color={SERIES[6]} />
      <Tile icon={TrendingUp} label="Top language" value={langs[0]?.[0] ?? "–"} sub={`${langs[0]?.[1] ?? 0} repos · ${langs.length} languages`} color={SERIES[5]} />
      <Tile icon={GitFork} label="Combined stars" value={fmt(totalStars)} sub={known ? `${orgs} orgs · ${known - orgs} individuals` : "owner data unavailable"} color={SERIES[7]} />
    </div>
  );
}

/* --- AI briefing ---------------------------------------------------------- */
export function InsightsPanel({ insights, onPick }: { insights: Insights; onPick: (name: string) => void }) {
  const RepoLink = ({ name }: { name: string }) => (
    <button onClick={() => onPick(name)} className="font-medium text-[#6aa8ff] hover:underline">{name}</button>
  );
  return (
    <section className="card relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "linear-gradient(120deg, rgba(57,135,229,.18), transparent 40%, rgba(213,81,129,.16) 70%, rgba(201,133,0,.12))" }} />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
          <Sparkles className="h-4 w-4 text-[#e87ba4]" /> Strategist briefing
          <span className="chip ml-1">{insights.source === "groq" ? "Groq LLM" : "rule-based"}</span>
        </div>
        <h2 className="mt-2 text-2xl font-bold leading-tight md:text-3xl"><span className="gradient-text">{insights.headline}</span></h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-ink-2">{insights.summary}</p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {insights.themes?.slice(0, 3).map((t, i) => (
            <div key={t.title} className="rounded-2xl border border-ring bg-surface-2/70 p-4" style={{ borderTop: `3px solid ${SERIES[i]}` }}>
              <h4 className="font-semibold">{t.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{t.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">{t.repos?.slice(0, 4).map((r) => <RepoLink key={r} name={r} />)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-ring bg-surface-2/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#f0b347]"><Target className="h-4 w-4" /> Top pick</div>
            <div className="mt-1 text-sm"><RepoLink name={insights.topPick?.repo} /></div>
            <p className="mt-1 text-xs text-ink-2">{insights.topPick?.why}</p>
          </div>
          <div className="rounded-2xl border border-ring bg-surface-2/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6aa8ff]"><Eye className="h-4 w-4" /> Early watchlist</div>
            <ul className="mt-1 space-y-1 text-xs">{insights.watchlist?.map((w) => <li key={w.repo}><RepoLink name={w.repo} /> <span className="text-ink-2">· {w.why}</span></li>)}</ul>
          </div>
          <div className="rounded-2xl border border-ring bg-surface-2/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#e87ba4]"><Flame className="h-4 w-4" /> Predictions</div>
            {insights.predictions?.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-ink-2">{insights.predictions.map((p) => <li key={p}>{p}</li>)}</ul>
            ) : <p className="mt-1 text-xs text-muted">Add a Groq key to get predictions.</p>}
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-xs text-ink-2 md:grid-cols-2">
          {insights.aiInsight && <p><b className="text-ink">AI signal:</b> {insights.aiInsight}</p>}
          {insights.languageInsight && <p><b className="text-ink">Language signal:</b> {insights.languageInsight}</p>}
        </div>
      </div>
    </section>
  );
}

export function SkeletonDash() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="grid gap-4 md:grid-cols-2"><div className="skeleton h-80" /><div className="skeleton h-80" /></div>
    </div>
  );
}

export type { Repo };
