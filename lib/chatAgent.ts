import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { makeLLM } from "./llm";
import type { Dataset, Repo } from "./types";

const brief = (r: Repo) => ({
  repo: r.fullName,
  description: r.description,
  language: r.language,
  stars: r.stars,
  forks: r.forks,
  starsGained: r.starsPeriod,
  metrics: r.metrics && {
    ageDays: r.metrics.ageDays,
    acceleration: r.metrics.acceleration,
    momentumPct: r.metrics.momentumPct,
    healthScore: r.metrics.healthScore,
    trendType: r.metrics.trendType,
    scores: r.metrics.scores,
  },
  license: r.details?.license,
  topics: r.details?.topics,
  contributors: r.contributors,
  latestRelease: r.latestRelease?.tag,
  ai: r.ai && { reason: r.ai.reason, category: r.ai.category, models: r.ai.aiModels, stack: r.ai.techStack, useCases: r.ai.useCases, hype: r.ai.hypeScore, substance: r.ai.substanceScore },
  readme: r.readmeExcerpt?.slice(0, 700),
});

function buildTools(data: Dataset) {
  const find = (q: string) => {
    const s = q.toLowerCase();
    return data.repos.find((r) => r.fullName.toLowerCase() === s) ?? data.repos.find((r) => r.fullName.toLowerCase().includes(s) || r.name.toLowerCase() === s);
  };
  return [
    tool(async ({ name }) => JSON.stringify(find(name) ? brief(find(name)!) : { error: `No trending repo matching "${name}"` }), {
      name: "get_repo",
      description: "Get full details, metrics and AI analysis for one trending repo by name or owner/name.",
      schema: z.object({ name: z.string() }),
    }),
    tool(
      async ({ metric, n }) => {
        const val = (r: Repo): number =>
          ({ stars: r.stars, starsGained: r.starsPeriod, forks: r.forks, acceleration: r.metrics?.acceleration ?? 0, health: r.metrics?.healthScore ?? 0, hype: r.ai?.hypeScore ?? 0, substance: r.ai?.substanceScore ?? 0, youngest: -(r.metrics?.ageDays ?? 0) })[metric];
        return JSON.stringify([...data.repos].sort((a, b) => val(b) - val(a)).slice(0, n).map((r) => ({ repo: r.fullName, value: Math.abs(val(r)) })));
      },
      {
        name: "rank_repos",
        description: "Rank trending repos by a metric and return the top n.",
        schema: z.object({
          metric: z.enum(["stars", "starsGained", "forks", "acceleration", "health", "hype", "substance", "youngest"]),
          n: z.number().int().min(1).max(25).default(5),
        }),
      },
    ),
    tool(
      async ({ field, value }) => {
        const v = value.toLowerCase();
        const hits = data.repos.filter((r) => {
          if (field === "language") return r.language?.toLowerCase() === v;
          if (field === "category") return r.ai?.category.toLowerCase().includes(v);
          if (field === "model") return r.ai?.aiModels.some((m) => m.toLowerCase().includes(v));
          return `${r.description} ${r.details?.topics.join(" ")} ${r.readmeExcerpt}`.toLowerCase().includes(v);
        });
        return JSON.stringify(hits.map((r) => ({ repo: r.fullName, starsGained: r.starsPeriod, oneLiner: r.ai?.oneLiner })));
      },
      {
        name: "filter_repos",
        description: "Filter trending repos by language, category, AI model, or free-text keyword.",
        schema: z.object({ field: z.enum(["language", "category", "model", "keyword"]), value: z.string() }),
      },
    ),
    tool(async () => JSON.stringify({ meta: data.meta, insights: data.insights, count: data.repos.length }), {
      name: "get_overview",
      description: "Get the overall trend briefing, themes, predictions and run metadata.",
      schema: z.object({}),
    }),
  ];
}

export async function runChat(opts: { apiKey: string; model?: string; data: Dataset; history: { role: "user" | "assistant"; content: string }[] }) {
  const tools = buildTools(opts.data);
  const llm = makeLLM(opts.apiKey, opts.model, 0.4).bindTools(tools);

  const system = new SystemMessage(
    `You are Radar, an AI assistant inside a GitHub Trending analytics dashboard. Data was scraped live at ${opts.data.meta.fetchedAt} (window: ${opts.data.meta.since}).
Trending repos: ${opts.data.repos.map((r) => `#${r.rank} ${r.fullName}`).join(", ")}.
Use the tools to look up facts before answering. Be concise and specific, use markdown bullets, and cite numbers.`,
  );

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (s) => ({ messages: [await llm.invoke([system, ...s.messages])] }))
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, ["tools", END])
    .addEdge("tools", "agent")
    .compile();

  const messages: BaseMessage[] = opts.history.slice(-10).map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)));
  const result = await graph.invoke({ messages }, { recursionLimit: 12 });
  const last = result.messages[result.messages.length - 1];
  const toolsUsed = result.messages.flatMap((m) => ((m as AIMessage).tool_calls ?? []).map((t) => t.name));
  return { answer: typeof last.content === "string" ? last.content : JSON.stringify(last.content), toolsUsed };
}
