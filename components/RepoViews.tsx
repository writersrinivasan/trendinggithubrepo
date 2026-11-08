"use client";

import { ExternalLink, GitFork, Star, X, Scale, Clock, Users, Tag, CircleDot, Brain, Layers, HeartPulse } from "lucide-react";
import type { Repo } from "@/lib/types";
import { SERIES, OTHER, ago, ageLabel, fmt } from "@/lib/ui";

const scoreColor = (s: number) => (s >= 75 ? "#0ca30c" : s >= 50 ? "#fab219" : "#ec835a");

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[92px_1fr_28px] items-center gap-2 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, background: SERIES[0] }} />
      </span>
      <span className="tabular text-right text-ink-2">{value}</span>
    </div>
  );
}

export function RepoCard({ repo, periodWord, onOpen }: { repo: Repo; periodWord: string; onOpen: () => void }) {
  const m = repo.metrics;
  const ai = repo.ai;
  return (
    <article onClick={onOpen} className="card group min-w-0 cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-white/20">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={repo.details?.ownerAvatar ?? `https://github.com/${repo.owner}.png?size=80`} alt="" className="h-10 w-10 rounded-xl border border-ring" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">#{repo.rank}</span>
            <h3 className="truncate font-semibold"><span className="text-ink-2">{repo.owner}/</span>{repo.name}</h3>
          </div>
          <p className="truncate text-xs text-muted">{ai?.oneLiner || repo.description}</p>
        </div>
        {m && (
          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border-2 text-xs font-bold" style={{ borderColor: scoreColor(m.healthScore) }} title="Health score">
            {m.healthScore}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ai && <span className="chip" style={{ color: "var(--ink)" }}>{ai.category}</span>}
        {m && <span className="chip">{m.trendType}</span>}
        {repo.language && <span className="chip"><span className="h-2 w-2 rounded-full" style={{ background: repo.languageColor ?? OTHER }} />{repo.language}</span>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/70 p-2.5 text-center">
        <div><div className="text-sm font-bold text-[#6aa8ff]">+{fmt(repo.starsPeriod)}</div><div className="text-[10px] text-muted">{periodWord}</div></div>
        <div><div className="text-sm font-bold">{fmt(repo.stars)}</div><div className="text-[10px] text-muted">stars</div></div>
        <div><div className="text-sm font-bold">{m ? `${m.acceleration}×` : "–"}</div><div className="text-[10px] text-muted">acceleration</div></div>
      </div>

      {ai && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-ink-2"><b className="text-ink">Why it's trending: </b>{ai.reason}</p>}

      {ai && ai.aiModels.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-[#e87ba4]" />
          {ai.aiModels.slice(0, 5).map((x) => <span key={x} className="chip border-[#d55181]/40 text-[#f2a5c2]">{x}</span>)}
        </div>
      )}
    </article>
  );
}

export function RepoDrawer({ repo, periodWord, onClose }: { repo: Repo | null; periodWord: string; onClose: () => void }) {
  if (!repo) return null;
  const m = repo.metrics;
  const ai = repo.ai;
  const d = repo.details;
  const langTotal = repo.languages ? Object.values(repo.languages).reduce((a, b) => a + b, 0) : 0;
  const langs = repo.languages ? Object.entries(repo.languages).sort((a, b) => b[1] - a[1]) : [];
  const langSlices = [...langs.slice(0, 7), ...(langs.length > 7 ? [["Other", langs.slice(7).reduce((s, [, v]) => s + v, 0)] as [string, number]] : [])];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-ring bg-[var(--surface)] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d?.ownerAvatar ?? `https://github.com/${repo.owner}.png?size=80`} alt="" className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">#{repo.rank} trending · {m?.trendType}</div>
            <h2 className="text-xl font-bold">{repo.fullName}</h2>
            <p className="text-sm text-ink-2">{repo.description}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href={repo.url} target="_blank" rel="noreferrer" className="chip hover:text-ink"><ExternalLink className="h-3 w-3" /> GitHub</a>
          {d?.homepage && <a href={d.homepage} target="_blank" rel="noreferrer" className="chip hover:text-ink"><ExternalLink className="h-3 w-3" /> Homepage</a>}
          {ai && <span className="chip">analysis: {ai.source === "groq" ? "Groq LLM" : "rule-based"}</span>}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            [Star, `+${fmt(repo.starsPeriod)}`, periodWord],
            [Star, fmt(repo.stars), "total stars"],
            [GitFork, fmt(repo.forks), "forks"],
            [CircleDot, fmt(d?.openIssues), "open issues"],
            [Users, repo.contributors ? fmt(repo.contributors) : `${repo.builtBy.length}+`, "contributors"],
            [Clock, ageLabel(m?.ageDays), "age"],
          ].map(([Icon, v, l], i) => {
            const I = Icon as React.ElementType;
            return (
              <div key={i} className="rounded-xl bg-surface-2 p-3">
                <I className="mx-auto mb-1 h-3.5 w-3.5 text-muted" />
                <div className="font-bold">{v as string}</div>
                <div className="text-[10px] text-muted">{l as string}</div>
              </div>
            );
          })}
        </div>

        {ai && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Why it's trending</h3>
            <p className="text-sm leading-relaxed text-ink-2">{ai.reason}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted"><Brain className="h-3.5 w-3.5" /> AI models</h4>
                <div className="flex flex-wrap gap-1.5">{ai.aiModels.length ? ai.aiModels.map((x) => <span key={x} className="chip text-[#f2a5c2]">{x}</span>) : <span className="text-xs text-muted">None detected</span>}</div>
              </div>
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted"><Layers className="h-3.5 w-3.5" /> Tech stack</h4>
                <div className="flex flex-wrap gap-1.5">{ai.techStack.map((x) => <span key={x} className="chip">{x}</span>)}</div>
              </div>
            </div>
            {ai.useCases.length > 0 && (
              <div className="mt-3">
                <h4 className="mb-1 text-xs font-semibold text-muted">Use cases</h4>
                <ul className="list-disc pl-4 text-xs text-ink-2">{ai.useCases.map((u) => <li key={u}>{u}</li>)}</ul>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">Audience: <span className="text-ink-2">{ai.audience}</span> · Hype {ai.hypeScore} · Substance {ai.substanceScore}</p>
          </section>
        )}

        {m && (
          <section className="mt-6">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><HeartPulse className="h-4 w-4" /> Health {m.healthScore}/100</h3>
            <div className="space-y-1.5">
              {Object.entries(m.scores).map(([k, v]) => <Meter key={k} label={k[0].toUpperCase() + k.slice(1)} value={v} />)}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {[
                ["Stars/day now", fmt(m.periodStarsPerDay)],
                ["Stars/day lifetime", fmt(m.lifetimeStarsPerDay)],
                ["Momentum", `${m.momentumPct}% of total`],
                ["Fork ratio", m.forkRatio.toFixed(3)],
                ["Issues / 1k stars", `${m.issuesPer1kStars}`],
                ["Last push", ago(d?.pushedAt)],
                ["Created", d ? new Date(d.createdAt).toLocaleDateString() : "–"],
                ["Latest release", repo.latestRelease ? `${repo.latestRelease.tag} (${ago(repo.latestRelease.publishedAt)})` : "–"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-ring py-1"><dt className="text-muted">{k}</dt><dd className="tabular text-ink-2">{v}</dd></div>
              ))}
            </dl>
          </section>
        )}

        {langSlices.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Language breakdown</h3>
            <div className="flex h-3 overflow-hidden rounded-full">
              {langSlices.map(([l, v], i) => <span key={l} title={`${l} ${((v / langTotal) * 100).toFixed(1)}%`} style={{ width: `${(v / langTotal) * 100}%`, background: l === "Other" ? OTHER : SERIES[i], marginRight: 2 }} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
              {langSlices.map(([l, v], i) => <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: l === "Other" ? OTHER : SERIES[i] }} />{l} {((v / langTotal) * 100).toFixed(1)}%</span>)}
            </div>
          </section>
        )}

        <section className="mt-6 flex flex-wrap gap-1.5">
          {d?.license && <span className="chip"><Scale className="h-3 w-3" /> {d.license}</span>}
          {d?.topics.map((t) => <span key={t} className="chip"><Tag className="h-3 w-3" />{t}</span>)}
        </section>

        {repo.builtBy.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Top contributors</h3>
            <div className="flex flex-wrap gap-2">
              {repo.builtBy.map((c) => (
                <a key={c.login} href={`https://github.com/${c.login}`} target="_blank" rel="noreferrer" className="chip hover:text-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.avatar} alt="" className="h-4 w-4 rounded-full" /> {c.login}
                </a>
              ))}
            </div>
          </section>
        )}

        {repo.readmeExcerpt && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">README excerpt</h3>
            <p className="text-xs leading-relaxed text-muted">{repo.readmeExcerpt}</p>
          </section>
        )}
      </aside>
    </div>
  );
}
