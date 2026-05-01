"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase/client";
import { Brain, Send, Loader2, User, BookOpen, Trash2, Sparkles, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Source {
  kb_id: string;
  title: string;
  category: string;
  similarity: number;
  source_url: string;
  source_type: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
}

// ── Starter prompts shown when chat is empty ──────────────────────────────────

const STARTER_PROMPTS = [
  "Summarise what I know about AI and machine learning",
  "What are the key insights from my recent articles?",
  "What topics appear most frequently in my knowledge base?",
  "Give me an overview of everything I've saved about productivity",
];

// ── Similarity → confidence label ─────────────────────────────────────────────

function confidenceLabel(sim: number): string {
  if (sim >= 0.8) return "High";
  if (sim >= 0.6) return "Medium";
  return "Low";
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source, index }: { source: Source; index: number }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-medium text-slate-500">[{index + 1}]</span>
      <span className="text-xs text-slate-700 font-medium truncate max-w-48">{source.title}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{source.category}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          source.similarity >= 0.8
            ? "bg-green-100 text-green-700"
            : source.similarity >= 0.6
            ? "bg-amber-100 text-amber-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {confidenceLabel(source.similarity)}
      </span>
      {source.source_url && source.source_type === "url" && (
        <a
          href={source.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  accessToken: string | null;
}

export default function RagChatbot({ accessToken }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [token, setToken] = useState<string | null>(accessToken);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (accessToken) { setToken(accessToken); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
  }, [accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !token || streaming) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };

      const assistantId = `a-${Date.now()}`;
      const assistantPlaceholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setInput("");
      setStreaming(true);

      const history: { role: "user" | "assistant"; content: string }[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text.trim() },
      ];

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages: history }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accText = "";
        let finalSources: Source[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const chunk = JSON.parse(line.slice(6));

              if (chunk.type === "text") {
                accText += chunk.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: accText, streaming: true }
                      : m
                  )
                );
              } else if (chunk.type === "sources") {
                finalSources = chunk.sources;
              } else if (chunk.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: accText, sources: finalSources, streaming: false }
                      : m
                  )
                );
              } else if (chunk.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: chunk.message, streaming: false }
                      : m
                  )
                );
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Sorry, something went wrong. Please try again.",
                    streaming: false,
                  }
                : m
            )
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, token, streaming]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-100">
            <Brain className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Knowledge Assistant</h2>
            <p className="text-xs text-slate-500">Answers from your personal knowledge base</p>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-50"
          >
            <Trash2 size={13} />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {isEmpty ? (
          <EmptyState prompts={STARTER_PROMPTS} onSelect={sendMessage} disabled={!token} />
        ) : (
          <div className="space-y-5 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageRow key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t px-4 py-3 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your knowledge base… (Enter to send, Shift+Enter for newline)"
              disabled={streaming || !token}
              rows={1}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:opacity-50 transition-all"
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || streaming || !token}
            className="shrink-0 h-10 w-10 p-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
          >
            {streaming ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <Send size={16} className="text-white" />
            )}
          </Button>
        </form>
        <p className="text-center text-[10px] text-slate-300 mt-2">
          Responses are grounded in your knowledge base only
        </p>
      </div>
    </div>
  );
}

// ── Empty state with suggested prompts ────────────────────────────────────────

function EmptyState({
  prompts,
  onSelect,
  disabled,
}: {
  prompts: string[];
  onSelect: (p: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-72 py-12 text-center px-4">
      <div className="p-4 rounded-full bg-indigo-50 mb-4">
        <Sparkles className="h-7 w-7 text-indigo-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">
        Ask your knowledge base anything
      </h3>
      <p className="text-xs text-slate-400 mb-6 max-w-sm">
        I'll search through everything you've saved — articles, PDFs, emails — and answer from your own knowledge.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            disabled={disabled}
            className="text-left text-xs text-slate-600 px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Single message row ────────────────────────────────────────────────────────

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
          isUser ? "bg-indigo-600" : "bg-slate-100"
        }`}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Brain size={14} className="text-indigo-600" />
        )}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-slate-100 text-slate-800 rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-strong:text-slate-800">
              {message.content ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce delay-0">·</span>
                  <span className="animate-bounce delay-100">·</span>
                  <span className="animate-bounce delay-200">·</span>
                </span>
              )}
              {message.streaming && message.content && (
                <span className="inline-block w-0.5 h-3.5 bg-slate-500 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && !message.streaming && (
          <div className="w-full px-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <BookOpen size={11} className="text-slate-400" />
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                Sources from your KB
              </span>
            </div>
            <div className="space-y-1.5">
              {message.sources.map((src, i) => (
                <SourceBadge key={src.kb_id + i} source={src} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
