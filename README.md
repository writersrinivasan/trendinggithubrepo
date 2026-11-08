# Trending Radar

A live, infographic-style dashboard of GitHub Trending, built with Next.js 15, a LangGraph multi-agent pipeline, and Groq (bring your own key).

Every page load and every **Refresh** runs a fresh scrape. Nothing is cached.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Open the app, click **Add Groq key** and paste a key from https://console.groq.com/keys. The app checks the key and lists the models it can use.
Adding a GitHub token is optional but recommended. Without one, GitHub allows only 60 API calls per hour, which is about 2–3 runs.

Keys are saved in your browser's localStorage and sent to this app's own API routes in request headers.
Alternatively, put them in `.env.local` (see `.env.example`).

## Agent pipeline (`lib/graph.ts`)

```
START → Scout → Enricher → Quant ─┬─ Send ×N → Analyst (parallel, Groq) ─┐
                                  └─ (no key) → Heuristic analyst ───────┴→ Strategist (Groq) → END
```

| Agent | What it does |
|---|---|
| **Scout** | Scrapes `github.com/trending` (daily / weekly / monthly, by language) |
| **Enricher** | GitHub REST API + READMEs. Checks the live API quota and chooses light, languages, or full mode (contributors, releases) |
| **Quant** | Deterministic analytics: acceleration (current pace ÷ lifetime pace), momentum, fork ratio, issue load, and six health scores |
| **Analyst ×N** | Fans out in parallel batches with LangGraph `Send`. Groq explains *why* each repo is trending and returns category, AI models used, tech stack, use cases, and hype vs. substance scores |
| **Strategist** | Writes the briefing: headline, themes, predictions, top pick, early watchlist |
| **Radar chat** (`lib/chatAgent.ts`) | A LangGraph ReAct agent with 4 tools (`get_repo`, `rank_repos`, `filter_repos`, `get_overview`) that query the live dataset |

Progress streams to the UI over Server-Sent Events (`/api/analyze`). Any LLM failure falls back to rule-based analysis, so the dashboard always renders.
