import type { Repo, RepoAI, Insights, Since } from "./types";
import { guessCategory, looksAI } from "./detect";

const DAY = 86_400_000;
const PERIOD_DAYS: Record<Since, number> = { daily: 1, weekly: 7, monthly: 30 };
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const log = (n: number) => Math.log10(Math.max(1, n));

/** Deterministic analytics — the "Quant agent". No LLM needed. */
export function computeMetrics(repos: Repo[], since: Since): Repo[] {
  const now = Date.now();
  const maxStars = Math.max(...repos.map((r) => r.stars), 10);
  const maxPeriod = Math.max(...repos.map((r) => r.starsPeriod), 1);
  const maxForks = Math.max(...repos.map((r) => r.forks), 10);

  return repos.map((r) => {
    const d = r.details;
    const ageDays = d ? Math.max(1, (now - Date.parse(d.createdAt)) / DAY) : 365;
    const freshnessDays = d ? Math.max(0, (now - Date.parse(d.pushedAt)) / DAY) : 30;
    const lifetimeStarsPerDay = r.stars / ageDays;
    const periodStarsPerDay = r.starsPeriod / PERIOD_DAYS[since];
    // Without API metadata the true age is unknown, so acceleration can't be computed honestly.
    const acceleration = d && lifetimeStarsPerDay > 0 ? periodStarsPerDay / lifetimeStarsPerDay : 0;
    const momentumPct = r.stars ? (r.starsPeriod / r.stars) * 100 : 0;
    const issuesPer1kStars = d && r.stars ? (d.openIssues / r.stars) * 1000 : 0;
    const contributors = r.contributors ?? r.builtBy.length * 8;

    const scores = {
      popularity: clamp((log(r.stars) / log(maxStars)) * 100),
      momentum: clamp((r.starsPeriod / maxPeriod) * 100),
      activity: clamp(100 - freshnessDays * 3),
      community: clamp(((log(contributors + 1) / log(500)) * 100 + (log(r.forks + 1) / log(maxForks + 1)) * 100) / 2),
      documentation: clamp(
        Math.min(60, (r.readmeLength ?? 0) / 150) + (d?.license ? 20 : 0) + (d?.homepage ? 10 : 0) + Math.min(10, (d?.topics.length ?? 0) * 2),
      ),
      hygiene: clamp(100 - issuesPer1kStars * 1.5),
    };
    const healthScore = clamp(
      scores.activity * 0.25 + scores.community * 0.2 + scores.documentation * 0.2 + scores.hygiene * 0.2 + scores.popularity * 0.15,
    );

    let trendType = "Steady climber";
    if (!d) trendType = "No API data";
    else if (ageDays < 45) trendType = "Brand-new breakout";
    else if (ageDays < 180 && acceleration > 2) trendType = "Rising star";
    else if (ageDays > 730 && acceleration > 3) trendType = "Revival";
    else if (acceleration > 4) trendType = "Accelerating";
    else if (r.stars > 50_000) trendType = "Evergreen giant";

    return {
      ...r,
      metrics: {
        ageDays: Math.round(ageDays),
        lifetimeStarsPerDay: +lifetimeStarsPerDay.toFixed(1),
        periodStarsPerDay: +periodStarsPerDay.toFixed(1),
        momentumPct: +momentumPct.toFixed(2),
        acceleration: +acceleration.toFixed(1),
        forkRatio: +(r.stars ? r.forks / r.stars : 0).toFixed(3),
        issuesPer1kStars: +issuesPer1kStars.toFixed(1),
        freshnessDays: +freshnessDays.toFixed(1),
        scores,
        healthScore,
        trendType,
      },
    };
  });
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

/** Fallback when no Groq key is set: rule-based analysis so the app still works. */
export function heuristicAI(r: Repo, since: Since): RepoAI {
  const m = r.metrics!;
  const periodWord = since === "daily" ? "today" : since === "weekly" ? "this week" : "this month";
  const parts = [`Gained ${fmt(r.starsPeriod)} stars ${periodWord} (${m.momentumPct}% of its total).`];
  if (m.ageDays < 45) parts.push(`It is only ${m.ageDays} days old, so this is a fresh launch getting discovered.`);
  else if (m.acceleration > 2) parts.push(`It is growing ${m.acceleration}× faster than its lifetime average, which suggests a new release or viral mention.`);
  if (r.detectedModels.length) parts.push(`It works with ${r.detectedModels.slice(0, 3).join(", ")}, riding the current AI wave.`);
  if (r.builtBy.length >= 5) parts.push("Several active contributors are shipping in parallel.");
  return {
    reason: parts.join(" "),
    oneLiner: r.description || r.name,
    category: guessCategory(r),
    aiModels: r.detectedModels,
    techStack: [r.language, ...r.detectedFrameworks].filter(Boolean).slice(0, 6) as string[],
    useCases: [],
    audience: "Developers",
    hypeScore: clamp(m.scores.momentum),
    substanceScore: clamp((m.scores.documentation + m.scores.community + m.scores.activity) / 3),
    isAI: looksAI(r),
    source: "heuristic",
  };
}

export function heuristicInsights(repos: Repo[]): Insights {
  const byPeriod = [...repos].sort((a, b) => b.starsPeriod - a.starsPeriod);
  const langs = new Map<string, number>();
  repos.forEach((r) => r.language && langs.set(r.language, (langs.get(r.language) ?? 0) + 1));
  const topLang = [...langs.entries()].sort((a, b) => b[1] - a[1])[0];
  const ai = repos.filter((r) => r.ai?.isAI);
  const cats = new Map<string, string[]>();
  repos.forEach((r) => {
    const c = r.ai?.category ?? "Other";
    cats.set(c, [...(cats.get(c) ?? []), r.fullName]);
  });
  const themes = [...cats.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([title, list]) => ({ title, description: `${list.length} trending repos fall into ${title}.`, repos: list.slice(0, 4) }));

  return {
    headline: `${byPeriod[0]?.fullName ?? "—"} leads with ${fmt(byPeriod[0]?.starsPeriod ?? 0)} new stars`,
    summary: `${repos.length} repos trending. ${ai.length} of them (${Math.round((ai.length / Math.max(1, repos.length)) * 100)}%) are AI-related. Add a Groq key in Settings for analysis written by the agents.`,
    themes,
    predictions: [],
    topPick: { repo: byPeriod[0]?.fullName ?? "", why: "Highest star gain in the selected window." },
    watchlist: [...repos]
      .sort((a, b) => (b.metrics?.acceleration ?? 0) - (a.metrics?.acceleration ?? 0))
      .slice(0, 3)
      .map((r) => ({ repo: r.fullName, why: `${r.metrics?.acceleration}× its usual growth rate` })),
    languageInsight: topLang ? `${topLang[0]} dominates with ${topLang[1]} of ${repos.length} repos.` : "",
    aiInsight: `${ai.length} AI-related repos.`,
    source: "heuristic",
  };
}
