import { radarGraph } from "@/lib/graph";
import type { Dataset, Insights, LogEntry, Repo, RepoAI, RunMeta, Since } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Streams the LangGraph run as Server-Sent Events: one event per agent step, then the final dataset. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { since?: Since; language?: string; model?: string };
  const since: Since = ["daily", "weekly", "monthly"].includes(body.since ?? "") ? body.since! : "daily";
  const groqKey = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY || undefined;
  const githubToken = req.headers.get("x-github-token") || process.env.GITHUB_TOKEN || undefined;
  const started = Date.now();

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let repos: Repo[] = [];
      const analyses: Record<string, RepoAI> = {};
      let insights: Insights | null = null;
      let meta: Partial<RunMeta> = {};

      try {
        const events = await radarGraph.stream(
          { since, language: body.language ?? "" },
          { configurable: { groqKey, model: body.model, githubToken }, streamMode: ["updates", "custom"] },
        );
        for await (const [mode, chunk] of events as AsyncIterable<[string, any]>) {
          if (mode === "custom") {
            send("progress", chunk);
            continue;
          }
          for (const [node, update] of Object.entries<any>(chunk)) {
            if (!update) continue;
            if (update.repos) repos = update.repos;
            if (update.analyses) Object.assign(analyses, update.analyses);
            if (update.insights) insights = update.insights;
            if (update.meta) meta = { ...meta, ...update.meta };
            send("step", { node, logs: (update.logs ?? []) as LogEntry[] });
          }
        }
        const dataset: Dataset = {
          repos: repos.map((r) => ({ ...r, ai: analyses[r.fullName] })),
          insights,
          meta: { ...(meta as RunMeta), model: groqKey ? body.model ?? null : null, durationMs: Date.now() - started },
        };
        send("done", dataset);
      } catch (e) {
        send("error", { message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
