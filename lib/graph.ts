import { Annotation, END, START, Send, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { enrichRepos, rateRemaining, scrapeTrending } from "./github";
import { computeMetrics, heuristicAI, heuristicInsights } from "./metrics";
import { JSON_MODE, makeLLM, parseJSON } from "./llm";
import { CATEGORIES, type Category, type Insights, type LogEntry, type Repo, type RepoAI, type RunMeta, type Since } from "./types";

/* ------------------------------------------------------------------ state */

export const RadarState = Annotation.Root({
  since: Annotation<Since>(),
  language: Annotation<string>(),
  repos: Annotation<Repo[]>({ reducer: (_, b) => b, default: () => [] }),
  analyses: Annotation<Record<string, RepoAI>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
  insights: Annotation<Insights | null>({ reducer: (_, b) => b, default: () => null }),
  meta: Annotation<Partial<RunMeta>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
  logs: Annotation<LogEntry[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
type S = typeof RadarState.State;

export interface RadarConfig {
  groqKey?: string;
  model?: string;
  githubToken?: string;
}
const cfg = (c: LangGraphRunnableConfig) => (c.configurable ?? {}) as RadarConfig;
const log = (agent: string, message: string, level: LogEntry["level"] = "info"): LogEntry => ({ agent, message, level, at: Date.now() });
const emit = (c: LangGraphRunnableConfig, agent: string, message: string) => c.writer?.({ agent, message, at: Date.now() });

/* ------------------------------------------------------------------ agents */

/** 1. Scout: live-scrapes github.com/trending. */
async function scout(state: S, config: LangGraphRunnableConfig) {
  emit(config, "scout", `Scanning github.com/trending (${state.since}${state.language ? ", " + state.language : ""})…`);
  const repos = await scrapeTrending(state.since, state.language);
  if (!repos.length) throw new Error("No trending repositories found. GitHub may have changed its markup or blocked the request.");
  return {
    repos,
    meta: { since: state.since, language: state.language, fetchedAt: new Date().toISOString() },
    logs: [log("scout", `Found ${repos.length} trending repos. #1 is ${repos[0].fullName}`)],
  };
}

/** 2. Enricher: GitHub REST + README; decides on deep mode from the live quota. */
async function enricher(state: S, config: LangGraphRunnableConfig) {
  const { githubToken } = cfg(config);
  const remaining = await rateRemaining(githubToken);
  const n = state.repos.length;
  const level = remaining === null ? "light" : remaining >= n * 4 + 5 ? "full" : remaining >= n * 2 + 5 ? "languages" : "light";
  const deep = level === "full";
  emit(config, "enricher", `GitHub API quota: ${remaining ?? "?"} left, so running in ${level} mode`);
  const repos = await enrichRepos(state.repos, githubToken, level, (m) => emit(config, "enricher", m));
  const missing = repos.filter((r) => !r.details).length;
  return {
    repos,
    meta: { deepMode: deep, rateRemaining: remaining },
    logs: [
      log("enricher", `Enriched ${repos.length - missing}/${repos.length} repos${level === "full" ? " with languages, contributors and releases" : level === "languages" ? " with language breakdowns" : ""}`),
      ...(missing ? [log("enricher", `${missing} repos had no API metadata (rate limit?). Add a GitHub token in Settings.`, "warn")] : []),
    ],
  };
}

/** 3. Quant: deterministic scoring and analytics. */
async function quant(state: S) {
  const repos = computeMetrics(state.repos, state.since);
  const top = [...repos].sort((a, b) => (b.metrics!.acceleration ?? 0) - (a.metrics!.acceleration ?? 0))[0];
  return { repos, logs: [log("quant", `Scored ${repos.length} repos. Fastest accelerating: ${top.fullName} (${top.metrics!.acceleration}×)`)] };
}

/** Router: fan out to parallel Analyst agents (LangGraph Send) or fall back to heuristics. */
function route(state: S, config: LangGraphRunnableConfig) {
  if (!cfg(config).groqKey) return "heuristic";
  const BATCH = 4;
  const sends: Send[] = [];
  for (let i = 0; i < state.repos.length; i += BATCH) {
    sends.push(new Send("analyst", { ...state, repos: state.repos.slice(i, i + BATCH), batchNo: i / BATCH + 1 }));
  }
  return sends;
}

const ANALYST_SYSTEM = `You are a senior open-source analyst. For each GitHub repo you get, explain WHY it is trending right now, using the README excerpt and the metrics.
Return STRICT JSON: {"repos":[{"fullName":string,"reason":string (2-3 specific sentences: what's new or notable and why devs care now),"oneLiner":string (max 12 words),"category":one of ${JSON.stringify(CATEGORIES)},"aiModels":string[] (AI/LLM models it uses or supports, e.g. "Claude","GPT-5","Llama", empty if none),"techStack":string[] (max 6),"useCases":string[] (max 3, short),"audience":string (short),"hypeScore":0-100 (social buzz vs. normal),"substanceScore":0-100 (engineering depth and real usefulness),"isAI":boolean}]}
Be concrete. Do not invent features that aren't in the README.`;

/** 4. Analyst (parallel): Groq LLM explains why each repo is trending. */
async function analyst(state: S & { batchNo?: number }, config: LangGraphRunnableConfig) {
  const { groqKey, model } = cfg(config);
  const payload = state.repos.map((r) => ({
    fullName: r.fullName,
    description: r.description,
    language: r.language,
    topics: r.details?.topics,
    stars: r.stars,
    starsGained: r.starsPeriod,
    ageDays: r.metrics?.ageDays,
    acceleration: r.metrics?.acceleration,
    latestRelease: r.latestRelease?.tag,
    detectedModels: r.detectedModels,
    detectedFrameworks: r.detectedFrameworks,
    readme: r.readmeExcerpt,
  }));
  try {
    const llm = makeLLM(groqKey!, model);
    const res = await llm.invoke(
      [new SystemMessage(ANALYST_SYSTEM), new HumanMessage(`Window: ${state.since}\n${JSON.stringify(payload)}`)],
      JSON_MODE as never,
    );
    const parsed = parseJSON<{ repos: (Partial<RepoAI> & { fullName: string })[] }>(res.content);
    const analyses: Record<string, RepoAI> = {};
    for (const r of state.repos) {
      const hit = parsed.repos?.find((p) => p.fullName?.toLowerCase() === r.fullName.toLowerCase());
      const base = heuristicAI(r, state.since);
      analyses[r.fullName] = hit
        ? {
            ...base,
            ...hit,
            category: (CATEGORIES as readonly string[]).includes(hit.category as string) ? (hit.category as Category) : base.category,
            aiModels: [...new Set([...(hit.aiModels ?? []), ...r.detectedModels])].slice(0, 6),
            hypeScore: Math.round(Number(hit.hypeScore ?? base.hypeScore)),
            substanceScore: Math.round(Number(hit.substanceScore ?? base.substanceScore)),
            source: "groq",
          }
        : base;
    }
    return { analyses, logs: [log("analyst", `Batch ${state.batchNo}: analysed ${state.repos.map((r) => r.name).join(", ")}`)] };
  } catch (e) {
    const analyses = Object.fromEntries(state.repos.map((r) => [r.fullName, heuristicAI(r, state.since)]));
    return { analyses, logs: [log("analyst", `Batch ${state.batchNo} fell back to heuristics: ${(e as Error).message.slice(0, 160)}`, "warn")] };
  }
}

/** 4b. Heuristic analyst for keyless runs. */
async function heuristic(state: S) {
  const analyses = Object.fromEntries(state.repos.map((r) => [r.fullName, heuristicAI(r, state.since)]));
  return { analyses, logs: [log("analyst", "No Groq key, so a rule-based analyst ran instead. Add your key in Settings for AI analysis.", "warn")] };
}

const STRATEGIST_SYSTEM = `You are a tech trend strategist writing an infographic briefing on today's GitHub trending list.
Return STRICT JSON: {"headline":string (punchy, max 14 words),"summary":string (3-4 sentences on the big picture),"themes":[{"title":string,"description":string,"repos":string[] (fullNames)}] (3-4 themes),"predictions":string[] (3 short forward-looking calls),"topPick":{"repo":fullName,"why":string},"watchlist":[{"repo":fullName,"why":string}] (3 items, early-stage repos with high acceleration),"languageInsight":string,"aiInsight":string (which AI models/frameworks dominate and what that signals)}`;

/** 5. Strategist: synthesises the whole set into macro insights. */
async function strategist(state: S, config: LangGraphRunnableConfig) {
  const repos = state.repos.map((r) => ({ ...r, ai: state.analyses[r.fullName] }));
  const { groqKey, model } = cfg(config);
  if (!groqKey) return { insights: heuristicInsights(repos), logs: [log("strategist", "Built a rule-based briefing")] };
  try {
    const llm = makeLLM(groqKey, model, 0.5);
    const compact = repos.map((r) => ({
      repo: r.fullName,
      lang: r.language,
      stars: r.stars,
      gained: r.starsPeriod,
      ageDays: r.metrics?.ageDays,
      accel: r.metrics?.acceleration,
      health: r.metrics?.healthScore,
      category: r.ai?.category,
      models: r.ai?.aiModels,
      why: r.ai?.reason,
    }));
    const res = await llm.invoke([new SystemMessage(STRATEGIST_SYSTEM), new HumanMessage(`Window: ${state.since}\n${JSON.stringify(compact)}`)], JSON_MODE as never);
    const insights = { ...heuristicInsights(repos), ...parseJSON<Partial<Insights>>(res.content), source: "groq" as const };
    return { insights, meta: { model: model || null }, logs: [log("strategist", `Briefing ready: "${insights.headline}"`)] };
  } catch (e) {
    return { insights: heuristicInsights(repos), logs: [log("strategist", `Fell back to rule-based briefing: ${(e as Error).message.slice(0, 160)}`, "warn")] };
  }
}

/* ------------------------------------------------------------------ graph */

export const radarGraph = new StateGraph(RadarState)
  .addNode("scout", scout)
  .addNode("enricher", enricher)
  .addNode("quant", quant)
  .addNode("analyst", analyst)
  .addNode("heuristic", heuristic)
  .addNode("strategist", strategist)
  .addEdge(START, "scout")
  .addEdge("scout", "enricher")
  .addEdge("enricher", "quant")
  .addConditionalEdges("quant", route, ["analyst", "heuristic"])
  .addEdge("analyst", "strategist")
  .addEdge("heuristic", "strategist")
  .addEdge("strategist", END)
  .compile();
