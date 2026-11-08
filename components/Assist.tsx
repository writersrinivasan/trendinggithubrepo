"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, MessageCircle, Send, X, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import type { Dataset } from "@/lib/types";

export interface Keys {
  groq: string;
  github: string;
  model: string;
}

const store = {
  get(k: string) {
    try { return localStorage.getItem(k) ?? ""; } catch { return ""; }
  },
  set(k: string, v: string) {
    try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* storage blocked */ }
  },
};

export function useKeys() {
  const [keys, setKeys] = useState<Keys>({ groq: "", github: "", model: "" });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setKeys({ groq: store.get("tr.groq"), github: store.get("tr.github"), model: store.get("tr.model") });
    setLoaded(true);
  }, []);
  const save = (k: Keys) => {
    store.set("tr.groq", k.groq);
    store.set("tr.github", k.github);
    store.set("tr.model", k.model);
    setKeys(k);
  };
  return { keys, save, loaded };
}

export const keyHeaders = (k: Keys): Record<string, string> => ({
  ...(k.groq ? { "x-groq-key": k.groq } : {}),
  ...(k.github ? { "x-github-token": k.github } : {}),
});

/* --- Settings (BYOK) ------------------------------------------------------ */
export function SettingsDialog({ open, keys, onSave, onClose }: { open: boolean; keys: Keys; onSave: (k: Keys) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(keys);
  const [models, setModels] = useState<string[]>([]);
  const [check, setCheck] = useState<{ state: "idle" | "loading" | "ok" | "err"; msg?: string }>({ state: "idle" });

  useEffect(() => { if (open) setDraft(keys); }, [open, keys]);

  const verify = async (groq = draft.groq) => {
    if (!groq) return;
    setCheck({ state: "loading" });
    const res = await fetch("/api/models", { headers: { "x-groq-key": groq } });
    const j = await res.json();
    if (!res.ok) return setCheck({ state: "err", msg: j.error });
    setModels(j.models);
    setCheck({ state: "ok", msg: `Key works. ${j.models.length} models available.` });
    if (!draft.model || !j.models.includes(draft.model)) {
      const pref = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "moonshotai/kimi-k2-instruct"].find((m) => j.models.includes(m)) ?? j.models[0];
      setDraft((d) => ({ ...d, groq, model: pref }));
    }
  };

  useEffect(() => { if (open && keys.groq) verify(keys.groq); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[#f0b347]" />
          <h2 className="text-lg font-bold">Bring your own keys</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 hover:bg-surface-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-1 text-xs text-muted">Keys stay in this browser and go only to this app's own server, which forwards them to Groq and GitHub for each run. Nothing is stored on the server.</p>

        <label className="mt-5 block text-xs font-semibold text-ink-2">Groq API key <a className="font-normal text-[#6aa8ff] hover:underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">get one free</a></label>
        <div className="mt-1 flex gap-2">
          <input type="password" value={draft.groq} onChange={(e) => setDraft({ ...draft, groq: e.target.value.trim() })} placeholder="gsk_…" className="flex-1 rounded-xl border border-ring bg-surface-2 px-3 py-2 text-sm outline-none focus:border-[#3987e5]" />
          <button onClick={() => verify()} className="rounded-xl border border-ring px-3 text-xs hover:bg-surface-2">Verify</button>
        </div>
        {check.state !== "idle" && (
          <p className={`mt-1.5 flex items-center gap-1 text-xs ${check.state === "err" ? "text-[#e66767]" : "text-ink-2"}`}>
            {check.state === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
            {check.state === "ok" && <CheckCircle2 className="h-3 w-3 text-[#0ca30c]" />}
            {check.state === "err" && <AlertTriangle className="h-3 w-3" />}
            {check.msg ?? "Checking…"}
          </p>
        )}

        <label className="mt-4 block text-xs font-semibold text-ink-2">Groq model</label>
        <select value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className="mt-1 w-full rounded-xl border border-ring bg-surface-2 px-3 py-2 text-sm outline-none">
          {!models.length && <option value={draft.model}>{draft.model || "llama-3.3-70b-versatile (default)"}</option>}
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="mt-4 block text-xs font-semibold text-ink-2">GitHub token <span className="font-normal text-muted">(optional: raises the API limit from 60 to 5,000/hr and unlocks contributor and release stats)</span></label>
        <input type="password" value={draft.github} onChange={(e) => setDraft({ ...draft, github: e.target.value.trim() })} placeholder="ghp_… or github_pat_…" className="mt-1 w-full rounded-xl border border-ring bg-surface-2 px-3 py-2 text-sm outline-none focus:border-[#3987e5]" />

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => { onSave({ groq: "", github: "", model: "" }); onClose(); }} className="rounded-xl px-4 py-2 text-xs text-muted hover:text-ink">Clear keys</button>
          <button onClick={() => { onSave(draft); onClose(); }} className="rounded-xl bg-gradient-to-r from-[#3987e5] to-[#9085e9] px-5 py-2 text-sm font-semibold text-white">Save & re-run</button>
        </div>
      </div>
    </div>
  );
}

/* --- Tiny markdown (bold, code, bullets) ---------------------------------- */
function Md({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p.startsWith("**") ? <b key={i} className="text-ink">{p.slice(2, -2)}</b> : p.startsWith("`") ? <code key={i} className="rounded bg-black/30 px-1">{p.slice(1, -1)}</code> : p,
    );
  return (
    <div className="space-y-1">
      {text.split("\n").filter((l) => l.trim()).map((l, i) =>
        /^\s*([-*]|\d+\.)\s/.test(l) ? <div key={i} className="flex gap-1.5 pl-1"><span className="text-muted">•</span><span>{inline(l.replace(/^\s*([-*]|\d+\.)\s/, ""))}</span></div>
          : /^#+\s/.test(l) ? <div key={i} className="font-semibold text-ink">{inline(l.replace(/^#+\s/, ""))}</div>
          : <p key={i}>{inline(l)}</p>,
      )}
    </div>
  );
}

/* --- Chat agent ----------------------------------------------------------- */
type Msg = { role: "user" | "assistant"; content: string; tools?: string[] };

export function ChatPanel({ data, keys, onNeedKey }: { data: Dataset | null; keys: Keys; onNeedKey: () => void }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Block body: newer Chrome returns a Promise from scrollIntoView, and an effect must return nothing or a cleanup function.
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const ask = async (q: string) => {
    if (!q.trim() || !data) return;
    if (!keys.groq) return onNeedKey();
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...keyHeaders(keys) },
        body: JSON.stringify({ data, model: keys.model || undefined, history: next.map(({ role, content }) => ({ role, content })) }),
      });
      const j = await res.json();
      setMsgs([...next, { role: "assistant", content: j.answer ?? `⚠️ ${j.error}`, tools: j.toolsUsed }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = ["Which repo is the best long-term bet and why?", "Compare the top 3 AI agent repos", "Which LLMs are most common here?", "Find young repos with high health scores"];

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!data} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#d55181] to-[#9085e9] px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-[#d55181]/30 transition hover:scale-105 disabled:opacity-40">
        <MessageCircle className="h-4 w-4" /> Ask Radar
      </button>
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-50 flex h-[70vh] flex-col overflow-hidden rounded-3xl border border-ring bg-[var(--surface)] shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[420px]">
          <div className="flex items-center gap-2 border-b border-ring px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-[#0ca30c]" />
            <div>
              <div className="text-sm font-semibold">Radar assistant</div>
              <div className="text-[10px] text-muted">LangGraph ReAct agent · Groq {keys.model || "default"} · 4 data tools</div>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto rounded-lg p-1 hover:bg-surface-2" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted">Ask anything about today's trending repos. The agent calls tools against the live data.</p>
                {suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="block w-full rounded-xl border border-ring px-3 py-2 text-left text-xs text-ink-2 hover:bg-surface-2">{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-10 rounded-2xl rounded-br-sm bg-[#3987e5]/25 px-3 py-2" : "mr-6 rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-ink-2"}>
                {m.role === "assistant" ? <Md text={m.content} /> : m.content}
                {m.tools && m.tools.length > 0 && <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted"><Wrench className="h-3 w-3" /> {m.tools.join(" → ")}</div>}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> agent is thinking…</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-ring p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={keys.groq ? "Ask about the trends…" : "Add a Groq key to chat"} className="flex-1 rounded-xl border border-ring bg-surface-2 px-3 py-2 text-sm outline-none focus:border-[#9085e9]" />
            <button disabled={busy} className="rounded-xl bg-[#9085e9] px-3 text-white disabled:opacity-50" aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      )}
    </>
  );
}
