"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, LabelList,
} from "recharts";
import type { Repo } from "@/lib/types";
import { OTHER, SERIES, count, fmt, topN, ageLabel } from "@/lib/ui";

/** Short label, but owner/name when several trending repos share a name (e.g. "skills"). */
const labelFor = (repos: Repo[]) => {
  const dup = count(repos, (r) => r.name);
  return (r: Repo) => ((dup.get(r.name) ?? 0) > 1 ? r.fullName : r.name);
};

const axis = { stroke: "var(--axis)", tick: { fill: "var(--muted)", fontSize: 11 }, tickLine: false };
const grid = <CartesianGrid stroke="var(--grid)" strokeDasharray="0" vertical={false} />;

function Tip({ active, payload, render }: { active?: boolean; payload?: { payload: any }[]; render: (p: any) => React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-ring bg-surface-2/95 px-3 py-2 text-xs text-ink shadow-xl backdrop-blur">{render(payload[0].payload)}</div>;
}

export function ChartCard({ title, subtitle, children, className = "", accent = SERIES[0] }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* --- Stars gained leaderboard -------------------------------------------- */
export function StarsGainedChart({ repos, periodWord }: { repos: Repo[]; periodWord: string }) {
  const lbl = labelFor(repos);
  const data = [...repos].sort((a, b) => b.starsPeriod - a.starsPeriod).map((r) => ({ name: lbl(r), full: r.fullName, v: r.starsPeriod, total: r.stars }));
  return (
    <ChartCard title={`Stars gained ${periodWord}`} subtitle="Who's pulling the most attention right now" accent={SERIES[0]}>
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 26)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 44 }} barCategoryGap={4}>
          <XAxis type="number" {...axis} tickFormatter={fmt} />
          <YAxis type="category" dataKey="name" width={160} {...axis} interval={0} tick={{ fill: "var(--ink-2)", fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<Tip render={(p) => (<><b>{p.full}</b><div>+{p.v.toLocaleString()} stars {periodWord}</div><div className="text-muted">{p.total.toLocaleString()} total</div></>)} />} />
          <Bar isAnimationActive={false} dataKey="v" fill={SERIES[0]} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="v" position="right" formatter={(v: unknown) => `+${fmt(v as number)}`} style={{ fill: "var(--ink-2)", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --- Donut with legend ---------------------------------------------------- */
export function DonutChart({ title, subtitle, data, accent }: { title: string; subtitle?: string; data: { name: string; value: number }[]; accent?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const color = (name: string, i: number) => (name === "Other" ? OTHER : SERIES[i]);
  return (
    <ChartCard title={title} subtitle={subtitle} accent={accent}>
      <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
        <div className="relative h-[190px] w-[190px] shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} stroke="var(--surface)" strokeWidth={2} paddingAngle={1}>
                {data.map((d, i) => <Cell key={d.name} fill={color(d.name, i)} />)}
              </Pie>
              <Tooltip content={<Tip render={(p) => (<><b>{p.name}</b><div>{p.value} repos · {Math.round((p.value / total) * 100)}%</div></>)} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{data.length}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted">groups</span>
          </div>
        </div>
        <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(d.name, i) }} />
              <span className="flex-1 truncate text-ink-2">{d.name}</span>
              <span className="tabular text-ink">{d.value}</span>
              <span className="tabular w-9 text-right text-muted">{Math.round((d.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/* --- Momentum map: total stars (log) vs stars gained ---------------------- */
export function MomentumMap({ repos, periodWord }: { repos: Repo[]; periodWord: string }) {
  const data = repos.map((r) => ({ x: Math.max(1, r.stars), y: Math.max(1, r.starsPeriod), z: r.forks, name: r.name, full: r.fullName, age: r.metrics?.ageDays }));
  const med = (arr: number[]) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)] ?? 1;
  const mx = med(data.map((d) => d.x));
  const my = med(data.map((d) => d.y));
  const labelled = new Set([...data].sort((a, b) => b.y - a.y).slice(0, 5).map((d) => d.full));
  return (
    <ChartCard title="Momentum map" subtitle={`Total stars vs. stars gained ${periodWord}. Bubble size = forks. Lines mark the medians.`} accent={SERIES[4]}>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis type="number" dataKey="x" scale="log" domain={["auto", "auto"]} {...axis} tickFormatter={fmt} name="Total stars" label={{ value: "Total stars (log)", position: "insideBottom", offset: -10, fill: "var(--muted)", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" scale="log" domain={["auto", "auto"]} {...axis} tickFormatter={fmt} width={44} />
          <ZAxis type="number" dataKey="z" range={[60, 600]} />
          <ReferenceLine x={mx} stroke="var(--axis)" strokeDasharray="4 4" />
          <ReferenceLine y={my} stroke="var(--axis)" strokeDasharray="4 4" />
          <Tooltip content={<Tip render={(p) => (<><b>{p.full}</b><div>{p.x.toLocaleString()} stars · +{p.y.toLocaleString()} {periodWord}</div><div className="text-muted">{fmt(p.z)} forks · age {ageLabel(p.age)}</div></>)} />} />
          <Scatter isAnimationActive={false} data={data} fill={SERIES[4]} fillOpacity={0.75} stroke="var(--surface)" strokeWidth={2}>
          </Scatter>
          <Scatter isAnimationActive={false} data={data.filter((d) => labelled.has(d.full))} fill="transparent" legendType="none">
            <LabelList dataKey="name" position="right" offset={12} style={{ fill: "var(--ink-2)", fontSize: 10 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-muted">
        <span>↖ <b className="text-ink-2">Breakouts:</b> small but surging</span>
        <span className="text-right">↗ <b className="text-ink-2">Giants on fire:</b> big and still surging</span>
      </div>
    </ChartCard>
  );
}

/* --- Acceleration --------------------------------------------------------- */
export function AccelerationChart({ repos }: { repos: Repo[] }) {
  const lbl = labelFor(repos);
  const data = [...repos].filter((r) => r.metrics && r.details).sort((a, b) => b.metrics!.acceleration - a.metrics!.acceleration).slice(0, 10).map((r) => ({ name: lbl(r), full: r.fullName, v: r.metrics!.acceleration, life: r.metrics!.lifetimeStarsPerDay, now: r.metrics!.periodStarsPerDay }));
  return (
    <ChartCard title="Growth acceleration" subtitle="Current stars/day ÷ lifetime average. 10× means 10 times its normal pace." accent={SERIES[3]}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -12, bottom: 40 }} barCategoryGap={6}>
          {grid}
          <XAxis dataKey="name" {...axis} interval={0} angle={-35} textAnchor="end" height={50} tick={{ fill: "var(--ink-2)", fontSize: 10 }} />
          <YAxis {...axis} tickFormatter={(v) => `${v}×`} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<Tip render={(p) => (<><b>{p.full}</b><div>{p.v}× its usual pace</div><div className="text-muted">{fmt(p.now)}/day now vs {fmt(p.life)}/day lifetime</div></>)} />} />
          <ReferenceLine y={1} stroke="var(--axis)" strokeDasharray="4 4" />
          <Bar isAnimationActive={false} dataKey="v" fill={SERIES[3]} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="v" position="top" formatter={(v: unknown) => `${fmt(v as number)}×`} style={{ fill: "var(--ink-2)", fontSize: 10 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --- Health radar for top 3 (all-pairs cap = 3 series) -------------------- */
export function HealthRadar({ repos }: { repos: Repo[] }) {
  const top = [...repos].filter((r) => r.metrics).sort((a, b) => b.starsPeriod - a.starsPeriod).slice(0, 3);
  const dims = ["popularity", "momentum", "activity", "community", "documentation", "hygiene"] as const;
  const data = dims.map((d) => ({ dim: d[0].toUpperCase() + d.slice(1), ...Object.fromEntries(top.map((r) => [r.name, r.metrics!.scores[d]])) }));
  return (
    <ChartCard title="Health fingerprint: top 3" subtitle="Six 0–100 scores from the Quant agent" accent={SERIES[2]}>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--grid)" />
          <PolarAngleAxis dataKey="dim" tick={{ fill: "var(--ink-2)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          {top.map((r, i) => <Radar isAnimationActive={false} key={r.fullName} name={r.name} dataKey={r.name} stroke={SERIES[i]} fill={SERIES[i]} fillOpacity={0.12} strokeWidth={2} dot={{ r: 3 }} />)}
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--ink-2)" }} iconType="circle" />
          <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--ring)", borderRadius: 12, fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --- Hype vs substance ---------------------------------------------------- */
export function HypeSubstance({ repos }: { repos: Repo[] }) {
  const data = repos.filter((r) => r.ai).map((r) => ({ x: r.ai!.hypeScore, y: r.ai!.substanceScore, name: r.name, full: r.fullName, cat: r.ai!.category }));
  const notable = [...data].sort((a, b) => b.x + b.y - (a.x + a.y)).slice(0, 5);
  return (
    <ChartCard title="Hype vs. substance" subtitle="Analyst agent scores. Top-right means real engineering with real buzz." accent={SERIES[6]}>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -10 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis type="number" dataKey="x" domain={[0, 100]} {...axis} label={{ value: "Hype →", position: "insideBottom", offset: -10, fill: "var(--muted)", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} {...axis} label={{ value: "Substance →", angle: -90, position: "insideLeft", offset: 20, fill: "var(--muted)", fontSize: 11 }} />
          <ReferenceLine x={50} stroke="var(--axis)" strokeDasharray="4 4" />
          <ReferenceLine y={50} stroke="var(--axis)" strokeDasharray="4 4" />
          <Tooltip content={<Tip render={(p) => (<><b>{p.full}</b><div>Hype {p.x} · Substance {p.y}</div><div className="text-muted">{p.cat}</div></>)} />} />
          <Scatter isAnimationActive={false} data={data} fill={SERIES[6]} stroke="var(--surface)" strokeWidth={2} />
          <Scatter isAnimationActive={false} data={notable} fill="transparent" legendType="none">
            <LabelList dataKey="name" position="right" offset={10} style={{ fill: "var(--ink-2)", fontSize: 10 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --- Simple horizontal count bars ----------------------------------------- */
export function CountBars({ title, subtitle, counts, color, empty }: { title: string; subtitle?: string; counts: Map<string, number>; color: string; empty: string }) {
  const data = topN(counts, 10).filter((d) => d.name !== "Other");
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ChartCard title={title} subtitle={subtitle} accent={color}>
      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d.name} className="group grid grid-cols-[110px_1fr_28px] items-center gap-2 text-xs" title={`${d.name}: ${d.value} repos`}>
              <span className="truncate text-ink-2">{d.name}</span>
              <span className="h-3 rounded-r-[4px] transition-all group-hover:brightness-125" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
              <span className="tabular text-right text-ink">{d.value}</span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

/* --- Age timeline --------------------------------------------------------- */
export function AgeChart({ repos }: { repos: Repo[] }) {
  const buckets = [
    { name: "< 1 month", test: (d: number) => d < 30 },
    { name: "1–6 months", test: (d: number) => d >= 30 && d < 180 },
    { name: "6–12 months", test: (d: number) => d >= 180 && d < 365 },
    { name: "1–3 years", test: (d: number) => d >= 365 && d < 1095 },
    { name: "3+ years", test: (d: number) => d >= 1095 },
  ];
  const data = buckets.map((b) => {
    const hits = repos.filter((r) => r.details && r.metrics && b.test(r.metrics.ageDays));
    return { name: b.name, v: hits.length, list: hits.map((r) => r.name).join(", ") };
  });
  return (
    <ChartCard title="How old are trending repos?" subtitle="Repo age when it hit the trending list" accent={SERIES[1]}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -24 }} barCategoryGap={8}>
          {grid}
          <XAxis dataKey="name" {...axis} interval={0} tick={{ fill: "var(--ink-2)", fontSize: 9 }} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<Tip render={(p) => (<><b>{p.name}</b><div>{p.v} repos</div><div className="max-w-56 text-muted">{p.list}</div></>)} />} />
          <Bar isAnimationActive={false} dataKey="v" fill={SERIES[1]} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="v" position="top" style={{ fill: "var(--ink-2)", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* --- Topic cloud ---------------------------------------------------------- */
export function TopicCloud({ repos }: { repos: Repo[] }) {
  const c = count(repos, (r) => r.details?.topics ?? []);
  const items = [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  const max = Math.max(1, ...items.map((i) => i[1]));
  return (
    <ChartCard title="Topic cloud" subtitle="GitHub topics across trending repos. Bigger means more repos." accent={SERIES[5]}>
      {items.length === 0 ? <p className="py-8 text-center text-xs text-muted">No topics available.</p> : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          {items.map(([t, n], i) => (
            <span key={t} title={`${n} repos`} className="cursor-default transition hover:text-ink" style={{ fontSize: 11 + (n / max) * 14, color: n === max ? "var(--ink)" : i < 8 ? "var(--ink-2)" : "var(--muted)", fontWeight: n > 1 ? 600 : 400 }}>
              #{t}
            </span>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
