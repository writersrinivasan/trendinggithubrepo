export type Since = "daily" | "weekly" | "monthly";

export const CATEGORIES = [
  "AI Agents",
  "LLM Tooling",
  "AI Models & Research",
  "Developer Tools",
  "Web & App Frameworks",
  "Infrastructure & DevOps",
  "Data & Analytics",
  "Security",
  "Learning Resources",
  "Productivity & Apps",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Contributor {
  login: string;
  avatar: string;
}

export interface RepoDetails {
  createdAt: string;
  pushedAt: string;
  openIssues: number;
  watchers: number;
  license: string | null;
  topics: string[];
  homepage: string | null;
  sizeKb: number;
  archived: boolean;
  ownerType: "User" | "Organization" | string;
  ownerAvatar: string;
  defaultBranch: string;
}

export interface RepoMetrics {
  ageDays: number;
  lifetimeStarsPerDay: number;
  periodStarsPerDay: number;
  /** stars gained this period as % of all stars */
  momentumPct: number;
  /** how many times faster than its lifetime average it's growing now */
  acceleration: number;
  forkRatio: number;
  issuesPer1kStars: number;
  freshnessDays: number;
  scores: {
    popularity: number;
    momentum: number;
    activity: number;
    community: number;
    documentation: number;
    hygiene: number;
  };
  healthScore: number;
  trendType: string;
}

export interface RepoAI {
  reason: string;
  oneLiner: string;
  category: Category;
  aiModels: string[];
  techStack: string[];
  useCases: string[];
  audience: string;
  hypeScore: number;
  substanceScore: number;
  isAI: boolean;
  source: "groq" | "heuristic";
}

export interface Repo {
  rank: number;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  language: string | null;
  languageColor: string | null;
  stars: number;
  forks: number;
  starsPeriod: number;
  builtBy: Contributor[];
  details?: RepoDetails;
  languages?: Record<string, number>;
  contributors?: number;
  latestRelease?: { tag: string; publishedAt: string } | null;
  readmeExcerpt?: string;
  readmeLength?: number;
  detectedModels: string[];
  detectedFrameworks: string[];
  metrics?: RepoMetrics;
  ai?: RepoAI;
}

export interface Insights {
  headline: string;
  summary: string;
  themes: { title: string; description: string; repos: string[] }[];
  predictions: string[];
  topPick: { repo: string; why: string };
  watchlist: { repo: string; why: string }[];
  languageInsight: string;
  aiInsight: string;
  source: "groq" | "heuristic";
}

export interface LogEntry {
  agent: string;
  message: string;
  at: number;
  level?: "info" | "warn" | "error";
}

export interface RunMeta {
  since: Since;
  language: string;
  fetchedAt: string;
  deepMode: boolean;
  rateRemaining: number | null;
  model: string | null;
  durationMs?: number;
}

export interface Dataset {
  repos: Repo[];
  insights: Insights | null;
  meta: RunMeta;
}
