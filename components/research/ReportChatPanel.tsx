"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  Trash2,
  Download,
  Sparkles,
  Bot,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  jobId: string;
  topic: string;
  accessToken: string | null;
  /** Starter prompts auto-generated from the report */
  starterPrompts?: string[];
  /** Called by parent to export chat as appendix markdown */
  onExportAppendix?: (markdown: string) => void;
}

export interface ReportChatPanelHandle {
  /** Open the panel and pre-fill a message */
  openWithPrompt: (prompt: string) => void;
  /** Whether the panel is currently open */
  isOpen: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function chatToMarkdown(messages: Message[], topic: string): string {
  const lines = [
    `## Chat Exploration — ${topic}`,
    "",
    `*${new Date().toLocaleString()}*`,
    "",
    "---",
    "",
  ];
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`**Q:** ${m.content}`);
    } else {
      lines.push(`**A:** ${m.content}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────────

const ReportChatPanel = forwardRef<ReportChatPanelHandle, Props>(
  ({ jobId, topic, accessToken, starterPrompts = [], onExportAppendix }, ref) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [token, setToken] = useState<string | null>(accessToken);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const storageKey = `research-chat-${jobId}`;

    // ── Auth ──────────────────────────────────────────────────────────────────
    useEffect(() => {
      if (accessToken) { setToken(accessToken); return; }
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setToken(data.session.access_token);
      });
    }, [accessToken]);

    // ── Persist chat in localStorage ──────────────────────────────────────────
    useEffect(() => {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { setMessages(JSON.parse(saved)); } catch { /* ignore */ }
      }
    }, [storageKey]);

    useEffect(() => {
      if (messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    }, [messages, storageKey]);

    // ── Scroll to bottom on new messages ──────────────────────────────────────
    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ── Auto-resize textarea ──────────────────────────────────────────────────
    useEffect(() => {
      const ta = inputRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }, [input]);

    // ── Expose handle to parent ───────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      isOpen: open,
      openWithPrompt: (prompt: string) => {
        setOpen(true);
        setInput(prompt);
        // Focus and scroll after render
        setTimeout(() => {
          inputRef.current?.focus();
          document.getElementById("report-chat-panel")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      },
    }));

    // ── Send message ──────────────────────────────────────────────────────────
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

        const history = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: text.trim() },
        ];

        abortRef.current = new AbortController();

        try {
          const res = await fetch("/api/research/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ messages: history, jobId }),
            signal: abortRef.current.signal,
          });

          if (!res.ok || !res.body) throw new Error("Stream failed");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let accText = "";

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
                      m.id === assistantId ? { ...m, content: accText, streaming: true } : m
                    )
                  );
                } else if (chunk.type === "done") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: accText, streaming: false } : m
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
              } catch { /* ignore malformed chunks */ }
            }
          }
        } catch (err: unknown) {
          if ((err as Error).name !== "AbortError") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false }
                  : m
              )
            );
          }
        } finally {
          setStreaming(false);
          abortRef.current = null;
        }
      },
      [messages, token, streaming, jobId]
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
      localStorage.removeItem(storageKey);
    };

    const exportAppendix = () => {
      const md = chatToMarkdown(messages, topic);
      if (onExportAppendix) {
        onExportAppendix(md);
      } else {
        const blob = new Blob([md], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-appendix-${jobId}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    };

    const isEmpty = messages.length === 0;
    const defaultStarters = [
      "What are the most important takeaways from this report?",
      "What gaps in the research should I investigate further?",
      "How confident are the findings and where is evidence thin?",
      "What are the counterarguments to the main conclusions?",
    ];
    const prompts = starterPrompts.length > 0 ? starterPrompts : defaultStarters;

    return (
      <div
        id="report-chat-panel"
        className="mt-6 rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--cp-research-border)" }}
      >
        {/* Toggle header */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors"
          style={{
            backgroundColor: open ? "var(--cp-research-panel)" : "var(--cp-research-surface)",
            borderBottom: open ? "1px solid var(--cp-research-border)" : "none",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: "rgba(79,70,229,0.1)" }}
            >
              <MessageSquare size={15} style={{ color: "var(--cp-research-accent)" }} />
            </div>
            <div>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--cp-research-text)" }}
              >
                Explore this Report
              </span>
              {messages.length > 0 && (
                <span
                  className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "rgba(79,70,229,0.12)",
                    color: "var(--cp-research-accent)",
                  }}
                >
                  {messages.length} message{messages.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--cp-research-muted)" }}>
              {open ? "Collapse" : "Ask questions about this report"}
            </span>
            {open ? (
              <ChevronUp size={15} style={{ color: "var(--cp-research-muted)" }} />
            ) : (
              <ChevronDown size={15} style={{ color: "var(--cp-research-muted)" }} />
            )}
          </div>
        </button>

        {/* Chat body */}
        {open && (
          <div style={{ backgroundColor: "var(--cp-research-surface)" }}>
            {/* Toolbar */}
            {!isEmpty && (
              <div
                className="flex items-center justify-between px-4 py-2 border-b"
                style={{ borderColor: "var(--cp-research-border)" }}
              >
                <span
                  className="text-xs"
                  style={{ color: "var(--cp-research-muted)" }}
                >
                  Chatting with the report · context is the full report content
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportAppendix}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors"
                    style={{
                      color: "var(--cp-research-text-secondary)",
                      border: "1px solid var(--cp-research-border)",
                    }}
                  >
                    <Download size={11} />
                    Export appendix
                  </button>
                  <button
                    onClick={clearChat}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors hover:text-red-500"
                    style={{
                      color: "var(--cp-research-muted)",
                      border: "1px solid var(--cp-research-border)",
                    }}
                  >
                    <Trash2 size={11} />
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div
              className="overflow-y-auto px-5 py-4 space-y-4"
              style={{ minHeight: 220, maxHeight: 520 }}
            >
              {isEmpty ? (
                <EmptyState
                  prompts={prompts}
                  onSelect={(p) => sendMessage(p)}
                  disabled={!token}
                />
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div
              className="border-t px-4 py-3"
              style={{
                borderColor: "var(--cp-research-border)",
                backgroundColor: "var(--cp-research-panel)",
              }}
            >
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about this report… (Enter to send, Shift+Enter for newline)"
                  disabled={streaming || !token}
                  rows={1}
                  className="flex-1 resize-none rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 transition-all"
                  style={{
                    borderColor: "var(--cp-research-border)",
                    backgroundColor: "var(--cp-research-surface)",
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming || !token}
                  className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg disabled:opacity-40 transition-colors"
                  style={{
                    backgroundColor: "var(--cp-research-accent)",
                    color: "#ffffff",
                  }}
                >
                  {streaming ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </form>
              <p
                className="text-center text-[10px] mt-1.5"
                style={{ color: "var(--cp-research-muted)" }}
              >
                Responses draw on the full report content · use "Explore" on any section to go deeper
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ReportChatPanel.displayName = "ReportChatPanel";
export default ReportChatPanel;

// ── Sub-components ─────────────────────────────────────────────────────────────

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
    <div className="flex flex-col items-center py-6 text-center">
      <div
        className="p-3 rounded-full mb-3"
        style={{ backgroundColor: "rgba(79,70,229,0.08)" }}
      >
        <Sparkles size={20} style={{ color: "var(--cp-research-accent)" }} />
      </div>
      <p
        className="text-sm font-medium mb-1"
        style={{ color: "var(--cp-research-text)" }}
      >
        Explore the report
      </p>
      <p
        className="text-xs mb-5 max-w-sm"
        style={{ color: "var(--cp-research-muted)" }}
      >
        Ask follow-up questions, dig into any section, or request additional context.
        You can also click "Explore" on any section above.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            disabled={disabled}
            className="text-left text-xs px-3.5 py-2.5 rounded-lg transition-all disabled:opacity-40"
            style={{
              border: "1px solid var(--cp-research-border)",
              backgroundColor: "var(--cp-research-panel)",
              color: "var(--cp-research-text-secondary)",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: isUser ? "var(--cp-research-accent)" : "var(--cp-research-panel)",
        }}
      >
        {isUser ? (
          <User size={13} color="#ffffff" />
        ) : (
          <Bot size={13} style={{ color: "var(--cp-research-accent)" }} />
        )}
      </div>

      <div
        className={`flex flex-col max-w-[82%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
          style={{
            backgroundColor: isUser
              ? "var(--cp-research-accent)"
              : "var(--cp-research-panel)",
            color: isUser ? "#ffffff" : "var(--cp-research-text)",
            borderRadius: isUser ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
          }}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5">
              {message.content ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                <span className="inline-flex gap-1 opacity-60">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                </span>
              )}
              {message.streaming && message.content && (
                <span
                  className="inline-block w-0.5 h-3.5 animate-pulse ml-0.5 align-middle"
                  style={{ backgroundColor: "var(--cp-research-text-secondary)" }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
