import * as cheerio from "cheerio";
import type { Repo, RepoDetails, Since } from "./types";
import { detectFrameworks, detectModels } from "./detect";

const UA = "Mozilla/5.0 (compatible; TrendingRepoRadar/1.0)";

const parseNum = (s: string | undefined) => {
  const n = parseInt((s ?? "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/** Scrape github.com/trending live. GitHub has no official trending API. */
export async function scrapeTrending(since: Since, language: string): Promise<Repo[]> {
  const path = language ? `/${encodeURIComponent(language.toLowerCase())}` : "";
  const url = `https://github.com/trending${path}?since=${since}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "text/html", "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(`GitHub trending responded ${res.status}`);
  const $ = cheerio.load(await res.text());
  const repos: Repo[] = [];

  $("article.Box-row").each((i, el) => {
    const row = $(el);
    const href = row.find("h2 a").attr("href")?.trim();
    if (!href) return;
    const [, owner, name] = href.split("/");
    const style = row.find(".repo-language-color").attr("style") ?? "";
    const builtBy = row
      .find('span:contains("Built by") img')
      .map((_, img) => ({
        login: ($(img).attr("alt") ?? "").replace(/^@/, ""),
        avatar: $(img).attr("src") ?? "",
      }))
      .get();

    repos.push({
      rank: i + 1,
      owner,
      name,
      fullName: `${owner}/${name}`,
      url: `https://github.com${href}`,
      description: row.find("p").first().text().trim(),
      language: row.find('[itemprop="programmingLanguage"]').text().trim() || null,
      languageColor: style.match(/#[0-9a-fA-F]{3,8}/)?.[0] ?? null,
      stars: parseNum(row.find(`a[href="${href}/stargazers"]`).text()),
      forks: parseNum(row.find(`a[href="${href}/forks"]`).text()),
      starsPeriod: parseNum(row.find("span.float-sm-right").text()),
      builtBy,
      detectedModels: [],
      detectedFrameworks: [],
    });
  });

  return repos;
}

function ghHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": UA,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function gh<T>(path: string, token?: string): Promise<{ data: T | null; res: Response }> {
  const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders(token), cache: "no-store" });
  if (!res.ok) return { data: null, res };
  return { data: (await res.json()) as T, res };
}

/** /rate_limit doesn't count against the quota. */
export async function rateRemaining(token?: string): Promise<number | null> {
  const { data } = await gh<{ resources: { core: { remaining: number } } }>("/rate_limit", token);
  return data?.resources.core.remaining ?? null;
}

async function fetchReadme(fullName: string): Promise<string> {
  for (const file of ["README.md", "readme.md", "README.MD", "Readme.md", "README.rst", "README"]) {
    const res = await fetch(`https://raw.githubusercontent.com/${fullName}/HEAD/${file}`, {
      cache: "no-store",
      headers: { "User-Agent": UA },
    });
    if (res.ok) return (await res.text()).slice(0, 80_000);
  }
  return "";
}

export function cleanReadme(md: string, max = 1400): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]{2,}/g, " ")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

interface GhRepo {
  created_at: string;
  pushed_at: string;
  open_issues_count: number;
  subscribers_count?: number;
  watchers_count: number;
  license: { spdx_id: string | null; name: string } | null;
  topics?: string[];
  homepage: string | null;
  size: number;
  archived: boolean;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  owner: { type: string; avatar_url: string };
}

/**
 * Enrich each repo with REST metadata + README. "Deep mode" (languages, contributor
 * count, latest release) only runs when there's enough API quota for it.
 */
export async function enrichRepos(
  repos: Repo[],
  token: string | undefined,
  level: "light" | "languages" | "full",
  onProgress?: (msg: string) => void,
): Promise<Repo[]> {
  const out = repos.map((r) => ({ ...r }));
  let done = 0;

  await pool(out, 5, async (repo) => {
    const [{ data: meta }, readme] = await Promise.all([
      gh<GhRepo>(`/repos/${repo.fullName}`, token),
      fetchReadme(repo.fullName),
    ]);

    if (meta) {
      const details: RepoDetails = {
        createdAt: meta.created_at,
        pushedAt: meta.pushed_at,
        openIssues: meta.open_issues_count,
        watchers: meta.subscribers_count ?? meta.watchers_count,
        license: meta.license?.spdx_id && meta.license.spdx_id !== "NOASSERTION" ? meta.license.spdx_id : meta.license?.name ?? null,
        topics: meta.topics ?? [],
        homepage: meta.homepage || null,
        sizeKb: meta.size,
        archived: meta.archived,
        ownerType: meta.owner.type,
        ownerAvatar: meta.owner.avatar_url,
        defaultBranch: meta.default_branch,
      };
      repo.details = details;
      // API numbers are fresher than the scraped, rounded HTML
      repo.stars = meta.stargazers_count || repo.stars;
      repo.forks = meta.forks_count || repo.forks;
    }

    if (level !== "light") {
      repo.languages = (await gh<Record<string, number>>(`/repos/${repo.fullName}/languages`, token)).data ?? undefined;
    }
    if (level === "full") {
      const [contrib, release] = await Promise.all([
        gh<unknown[]>(`/repos/${repo.fullName}/contributors?per_page=1&anon=1`, token),
        gh<{ tag_name: string; published_at: string }>(`/repos/${repo.fullName}/releases/latest`, token),
      ]);
      const last = contrib.res.headers.get("link")?.match(/[?&]page=(\d+)>; rel="last"/);
      repo.contributors = last ? parseInt(last[1], 10) : contrib.data?.length ?? undefined;
      repo.latestRelease = release.data ? { tag: release.data.tag_name, publishedAt: release.data.published_at } : null;
    }

    const haystack = `${repo.description}\n${repo.details?.topics.join(" ") ?? ""}\n${readme}`;
    repo.readmeLength = readme.length;
    repo.readmeExcerpt = cleanReadme(readme);
    repo.detectedModels = detectModels(haystack);
    repo.detectedFrameworks = detectFrameworks(haystack);

    done++;
    onProgress?.(`Enriched ${repo.fullName} (${done}/${out.length})`);
  });

  return out;
}
