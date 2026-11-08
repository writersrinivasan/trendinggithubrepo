import { ChatGroq } from "@langchain/groq";

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function makeLLM(apiKey: string, model?: string, temperature = 0.3) {
  return new ChatGroq({ apiKey, model: model || DEFAULT_MODEL, temperature, maxRetries: 4 });
}

/** Robust JSON extraction: strips <think> blocks and code fences, then grabs the outer object. */
export function parseJSON<T>(content: unknown): T {
  let text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => (typeof c === "string" ? c : c?.text ?? "")).join("") : String(content);
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(json)?/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in model response");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export const JSON_MODE = { response_format: { type: "json_object" as const } };
