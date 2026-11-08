import { runChat } from "@/lib/chatAgent";
import type { Dataset } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "Add your Groq API key in Settings to chat." }, { status: 401 });
  const { data, history, model } = (await req.json()) as { data: Dataset; history: { role: "user" | "assistant"; content: string }[]; model?: string };
  try {
    return Response.json(await runChat({ apiKey, model, data, history }));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
