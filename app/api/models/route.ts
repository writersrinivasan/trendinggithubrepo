export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists the chat models available to the user's Groq key and checks that the key works. */
export async function GET(req: Request) {
  const apiKey = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "No key" }, { status: 401 });
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  if (!res.ok) return Response.json({ error: `Groq rejected the key (${res.status})` }, { status: res.status });
  const { data } = (await res.json()) as { data: { id: string; active?: boolean; owned_by?: string }[] };
  const models = data
    .filter((m) => m.active !== false && !/whisper|tts|guard|orpheus|playai|distil|prompt-guard|compound/i.test(m.id))
    .map((m) => m.id)
    .sort();
  return Response.json({ models });
}
