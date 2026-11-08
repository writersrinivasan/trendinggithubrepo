import type { Category, Repo } from "./types";

/** Pattern → canonical model family. Ordered roughly by provider. */
const MODEL_PATTERNS: [RegExp, string][] = [
  [/\bgpt[-\s]?5(\.\d)?\b/i, "GPT-5"],
  [/\bgpt[-\s]?4(o|\.1|\.5)?\b/i, "GPT-4 family"],
  [/\bgpt[-\s]?oss\b/i, "GPT-OSS"],
  [/\b(o1|o3|o4)-(mini|pro|preview)\b/i, "OpenAI o-series"],
  [/\bclaude\b/i, "Claude"],
  [/\bgemini\b/i, "Gemini"],
  [/\bgemma\b/i, "Gemma"],
  [/\bllama[-\s]?\d?/i, "Llama"],
  [/\bmixtral\b|\bmistral\b|\bcodestral\b/i, "Mistral"],
  [/\bqwen\d?/i, "Qwen"],
  [/\bdeepseek/i, "DeepSeek"],
  [/\bkimi\b|\bmoonshot/i, "Kimi"],
  [/\bglm[-\s]?\d/i, "GLM"],
  [/\bgrok\b/i, "Grok"],
  [/\bphi-?\d\b/i, "Phi"],
  [/\bwhisper\b/i, "Whisper"],
  [/\bstable[-\s]?diffusion\b|\bsdxl\b/i, "Stable Diffusion"],
  [/\bflux(\.1)?\b(?=.{0,40}(model|image|diffusion|dev|schnell))/i, "FLUX"],
  [/\byolo(v?\d+)?\b/i, "YOLO"],
  [/\bsegment anything\b|\bsam\s?2\b/i, "SAM"],
  [/\bclip\b(?=.{0,40}(model|openai|embedding|vision))/i, "CLIP"],
  [/\bbert\b/i, "BERT"],
];

const FRAMEWORK_PATTERNS: [RegExp, string][] = [
  [/\blanggraph\b/i, "LangGraph"],
  [/\blangchain\b/i, "LangChain"],
  [/\bllama[-\s]?index\b/i, "LlamaIndex"],
  [/\bcrew\s?ai\b/i, "CrewAI"],
  [/\bautogen\b/i, "AutoGen"],
  [/\bmodel context protocol\b|\bmcp server\b|\bmcp\b/i, "MCP"],
  [/\bollama\b/i, "Ollama"],
  [/\bvllm\b/i, "vLLM"],
  [/\bllama\.cpp\b|\bgguf\b/i, "llama.cpp"],
  [/\bpytorch\b|\btorch\b/i, "PyTorch"],
  [/\btensorflow\b/i, "TensorFlow"],
  [/\bjax\b/i, "JAX"],
  [/\bhugging\s?face\b|\btransformers\b/i, "Hugging Face"],
  [/\bonnx\b/i, "ONNX"],
  [/\bopenai (api|sdk)\b|\bopenai_api_key\b/i, "OpenAI API"],
  [/\banthropic\b/i, "Anthropic API"],
  [/\bnext\.?js\b/i, "Next.js"],
  [/\bReact(\.js| Native)?\b/, "React"],
  [/\bfastapi\b/i, "FastAPI"],
  [/\bdocker\b/i, "Docker"],
  [/\bkubernetes\b|\bk8s\b/i, "Kubernetes"],
  [/\btauri\b/i, "Tauri"],
  [/\belectron\b/i, "Electron"],
];

const scan = (text: string, patterns: [RegExp, string][]) => {
  const found = new Set<string>();
  for (const [re, label] of patterns) if (re.test(text)) found.add(label);
  return [...found];
};

export const detectModels = (text: string) => scan(text, MODEL_PATTERNS);
export const detectFrameworks = (text: string) => scan(text, FRAMEWORK_PATTERNS);

const AI_WORDS = /\b(ai|llm|agent|agents|agentic|gpt|model|models|rag|prompt|inference|neural|machine learning|deep learning|embedding|diffusion|copilot|chatbot|mcp)\b/i;

export function guessCategory(r: Repo): Category {
  const t = `${r.name} ${r.description} ${r.details?.topics.join(" ") ?? ""}`.toLowerCase();
  if (/\bagent|agentic|autonomous|computer.use|browser.use/.test(t)) return "AI Agents";
  if (/\b(llm|rag|prompt|mcp|inference|embedding|vector|fine.?tun|lora|ollama|vllm)/.test(t)) return "LLM Tooling";
  if (/\b(model|diffusion|neural|paper|research|training|dataset|transformer)/.test(t) && AI_WORDS.test(t)) return "AI Models & Research";
  if (/\b(awesome|tutorial|course|learn|roadmap|interview|guide|book|examples?)\b/.test(t)) return "Learning Resources";
  if (/\b(security|pentest|vulnerab|exploit|malware|osint|auth|encrypt|privacy)/.test(t)) return "Security";
  if (/\b(kubernetes|docker|devops|deploy|cloud|infra|server|database|observability|monitor|proxy)/.test(t)) return "Infrastructure & DevOps";
  if (/\b(data|analytics|etl|sql|pipeline|visuali[sz]ation|dashboard|spreadsheet)/.test(t)) return "Data & Analytics";
  if (/\b(framework|react|vue|svelte|next|ui|component|web|mobile|android|ios|flutter)/.test(t)) return "Web & App Frameworks";
  if (/\b(cli|terminal|editor|ide|vscode|neovim|git|compiler|lint|sdk|devtool|debug|testing)/.test(t)) return "Developer Tools";
  if (/\b(app|productivity|notes|calendar|desktop|self.?hosted|tool)/.test(t)) return "Productivity & Apps";
  if (AI_WORDS.test(t)) return "LLM Tooling";
  return "Other";
}

export const looksAI = (r: Repo) =>
  AI_WORDS.test(`${r.description} ${r.details?.topics.join(" ") ?? ""}`) || r.detectedModels.length > 0;
