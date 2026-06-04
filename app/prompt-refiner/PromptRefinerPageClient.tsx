"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Brain,
  ChevronRight,
  Wand2,
  Copy,
  Check,
  Loader2,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type {
  RefinedVariant,
  RefineContext,
  PromptRefinerHistoryEntry,
} from "@/types/prompt-refiner";

interface Props {
  accessToken: string | null;
  user?: any;
}

export default function PromptRefinerPageClient({ accessToken, user }: Props) {
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState<RefineContext>({});
  const [showContext, setShowContext] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<RefinedVariant[] | null>(null);

  const [history, setHistory] = useState<PromptRefinerHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const authHeaders = useCallback(
    (): Record<string, string> => ({
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    }),
    [accessToken]
  );

  const loadHistory = useCallback(async () => {
    if (!accessToken) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/prompt-refiner/history?limit=20", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.entries ?? []);
      }
    } catch {
      // Non-fatal: history just stays as-is.
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRefine = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setVariants(null);
    try {
      const cleanContext = Object.fromEntries(
        Object.entries(context).filter(([, v]) => v && String(v).trim())
      );
      const res = await fetch("/api/prompt-refiner", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: prompt.trim(), context: cleanContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to refine prompt");
      setVariants(data.variants);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    setHistory((h) => h.filter((e) => e.id !== id));
    try {
      await fetch(`/api/prompt-refiner/history/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } catch {
      loadHistory();
    }
  };

  const reuseEntry = (entry: PromptRefinerHistoryEntry) => {
    setPrompt(entry.original_prompt);
    setContext(entry.context ?? {});
    setVariants(entry.variants);
    if (entry.context && Object.keys(entry.context).length) setShowContext(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppLayout user={user}>
      <div className="min-h-screen bg-slate-50">
        {/* Page header */}
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
              >
                <Brain size={14} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <ChevronRight size={13} className="text-slate-300 shrink-0" />
              <div className="p-2 rounded-lg bg-indigo-50">
                <Wand2 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="font-display font-bold text-slate-800">Prompt Refiner</h1>
                <p className="text-xs text-slate-500">
                  Turn rough prompts into two best-practice variants · Role · Format · Examples · Constraints
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Input card */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <Label htmlFor="prompt" className="text-sm font-semibold text-slate-700">
                Your prompt
              </Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. write a tweet about our new feature"
                className="mt-2 min-h-[140px] resize-y"
                maxLength={8000}
              />
              <div className="mt-1 text-right text-xs text-slate-400">
                {prompt.length}/8000
              </div>

              {/* Optional context */}
              <button
                type="button"
                onClick={() => setShowContext((s) => !s)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                {showContext ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Optional hints (role, format, audience, target model)
              </button>

              {showContext && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">Role / persona</Label>
                    <Input
                      value={context.role ?? ""}
                      onChange={(e) => setContext((c) => ({ ...c, role: e.target.value }))}
                      placeholder="senior marketer"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Output format</Label>
                    <Input
                      value={context.outputFormat ?? ""}
                      onChange={(e) =>
                        setContext((c) => ({ ...c, outputFormat: e.target.value }))
                      }
                      placeholder="markdown table"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Audience / tone</Label>
                    <Input
                      value={context.audience ?? ""}
                      onChange={(e) =>
                        setContext((c) => ({ ...c, audience: e.target.value }))
                      }
                      placeholder="non-technical founders"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Target model</Label>
                    <Input
                      value={context.targetModel ?? ""}
                      onChange={(e) =>
                        setContext((c) => ({ ...c, targetModel: e.target.value }))
                      }
                      placeholder="Claude / GPT-4"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <Button
                  onClick={handleRefine}
                  disabled={!prompt.trim() || loading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Refining…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} /> Refine prompt
                    </>
                  )}
                </Button>
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </div>

            {/* Results */}
            {variants && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {variants.map((v, i) => (
                  <VariantCard key={i} variant={v} />
                ))}
              </div>
            )}
          </div>

          {/* ── History sidebar ─────────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border bg-white p-5 shadow-sm sticky top-20">
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-700">History</h2>
              </div>

              {historyLoading && history.length === 0 ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Your refined prompts will appear here.
                </p>
              ) : (
                <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="group rounded-lg border border-slate-100 p-3 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                    >
                      <button
                        onClick={() => reuseEntry(entry)}
                        className="block w-full text-left"
                      >
                        <p className="text-sm text-slate-700 line-clamp-2">
                          {entry.original_prompt}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {new Date(entry.created_at).toLocaleString()} ·{" "}
                          {entry.variants.length} variants
                        </p>
                      </button>
                      <div className="mt-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Delete entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Refined variant card with copy-to-clipboard ─────────────────────────────
function VariantCard({ variant }: { variant: RefinedVariant }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(variant.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({
        title: "Copied to clipboard",
        description: `"${variant.title}" prompt is ready to paste.`,
      });
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Clipboard access was blocked by your browser.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{variant.title}</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="shrink-0 h-7 px-2"
        >
          {copied ? (
            <>
              <Check size={13} className="text-green-600" /> Copied
            </>
          ) : (
            <>
              <Copy size={13} /> Copy
            </>
          )}
        </Button>
      </div>

      <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-700 font-sans">
        {variant.prompt}
      </pre>

      {variant.techniques.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {variant.techniques.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] font-normal">
              {t}
            </Badge>
          ))}
        </div>
      )}

      {variant.rationale && (
        <p className="mt-3 text-xs text-slate-500 italic">{variant.rationale}</p>
      )}
    </div>
  );
}
