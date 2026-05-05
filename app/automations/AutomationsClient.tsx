"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Brain,
  Zap,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Globe,
  FileText,
  Bell,
  Tag,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Map,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
}

interface AutomationRun {
  id: string;
  automation_id: string;
  trigger_title: string | null;
  action_type: string;
  status: "done" | "error";
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

// ── Template definitions ──────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  iconBg: string;
  trigger_type: string;
  action_type: string;
  configField?: { key: string; label: string; placeholder: string };
}

const TEMPLATES: Template[] = [
  {
    id: "url_flashcards",
    name: "URL → Flashcards",
    tagline: "When you save a URL, auto-generate 5 study flashcards from its content",
    icon: <Globe size={18} />,
    iconBg: "bg-blue-100 text-blue-600",
    trigger_type: "url_added",
    action_type: "generate_flashcards",
  },
  {
    id: "pdf_concept_map",
    name: "PDF → Concept Map",
    tagline: "When you upload a PDF, automatically create a visual concept map",
    icon: <FileText size={18} />,
    iconBg: "bg-purple-100 text-purple-600",
    trigger_type: "pdf_added",
    action_type: "create_concept_map",
  },
  {
    id: "keyword_notify",
    name: "Keyword Alert",
    tagline: "When any new content contains a keyword you care about, notify you immediately",
    icon: <Bell size={18} />,
    iconBg: "bg-amber-100 text-amber-600",
    trigger_type: "keyword_match",
    action_type: "notify",
    configField: {
      key: "keyword",
      label: "Keyword to watch",
      placeholder: "e.g. machine learning, climate change",
    },
  },
  {
    id: "category_flashcards",
    name: "Category → Flashcards",
    tagline: "When content is saved to a specific category, auto-generate flashcards for it",
    icon: <Tag size={18} />,
    iconBg: "bg-green-100 text-green-600",
    trigger_type: "category_match",
    action_type: "generate_flashcards",
    configField: {
      key: "category",
      label: "Category to watch",
      placeholder: "e.g. Artificial Intelligence, Technology",
    },
  },
  {
    id: "any_notify",
    name: "New Content Alert",
    tagline: "Get a notification whenever any new content is added to your knowledge base",
    icon: <Sparkles size={18} />,
    iconBg: "bg-indigo-100 text-indigo-600",
    trigger_type: "any_added",
    action_type: "notify",
  },
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  generate_flashcards: <BookOpen size={13} />,
  create_concept_map: <Map size={13} />,
  notify: <Bell size={13} />,
  generate_flashcards_and_notify: <Sparkles size={13} />,
};

const ACTION_LABELS: Record<string, string> = {
  generate_flashcards: "Generate Flashcards",
  create_concept_map: "Create Concept Map",
  notify: "Send Notification",
  generate_flashcards_and_notify: "Flashcards + Notify",
};

const TRIGGER_LABELS: Record<string, string> = {
  url_added: "URL added",
  pdf_added: "PDF uploaded",
  rss_article: "RSS article ingested",
  any_added: "Any content added",
  category_match: "Category matches",
  keyword_match: "Keyword found",
};

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  accessToken: string | null;
}

export default function AutomationsClient({ userId, accessToken }: Props) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState("");
  const [configError, setConfigError] = useState("");
  const [showRuns, setShowRuns] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/automations", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAutomations(data.automations ?? []);
      setRuns(data.runs ?? []);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addAutomation = async (template: Template) => {
    if (!accessToken) return;
    const configField = template.configField;

    if (configField) {
      const val = configValue.trim();
      if (!val) { setConfigError(`Please enter a ${configField.label.toLowerCase()}`); return; }
      setConfigError("");
    }

    try {
      const trigger_config: Record<string, string> = {};
      if (template.configField) trigger_config[template.configField.key] = configValue.trim();

      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: template.name,
          trigger_type: template.trigger_type,
          trigger_config,
          action_type: template.action_type,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setConfigError(err.error ?? "Failed to create automation");
        return;
      }
      setAddingTemplate(null);
      setConfigValue("");
      fetchData();
    } catch { setConfigError("Failed to create automation"); }
  };

  const toggleAutomation = async (automation: Automation) => {
    if (!accessToken) return;
    const res = await fetch(`/api/automations/${automation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ enabled: !automation.enabled }),
    });
    if (res.ok) {
      setAutomations((prev) =>
        prev.map((a) => a.id === automation.id ? { ...a, enabled: !a.enabled } : a)
      );
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!accessToken) return;
    await fetch(`/api/automations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  };

  const activeTemplateIds = new Set(
    automations.map((a) => {
      return TEMPLATES.find(
        (t) => t.trigger_type === a.trigger_type && t.action_type === a.action_type
      )?.id;
    })
  );

  const user = { id: userId };

  return (
    <AppLayout user={user}>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-100">
              <Zap size={20} className="text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Automations</h1>
          </div>
          <p className="text-sm text-slate-500 ml-14">
            Set rules that run automatically when you add content to your knowledge base.
          </p>
        </div>

        {/* Template gallery */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Available Templates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map((t) => {
              const alreadyAdded = activeTemplateIds.has(t.id);
              const isAdding = addingTemplate === t.id;

              return (
                <div
                  key={t.id}
                  className={`bg-white rounded-xl border p-4 transition-shadow ${alreadyAdded ? "opacity-60" : "hover:shadow-md"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 p-2 rounded-lg ${t.iconBg}`}>{t.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">{t.name}</h3>
                        {alreadyAdded ? (
                          <span className="text-xs text-green-600 flex items-center gap-1 shrink-0">
                            <CheckCircle size={12} /> Active
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setAddingTemplate(t.id);
                              setConfigValue("");
                              setConfigError("");
                            }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shrink-0"
                          >
                            <Plus size={11} /> Add
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.tagline}</p>

                      {/* Config form */}
                      {isAdding && t.configField && (
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            value={configValue}
                            onChange={(e) => { setConfigValue(e.target.value); setConfigError(""); }}
                            placeholder={t.configField.placeholder}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && addAutomation(t)}
                          />
                          {configError && (
                            <p className="text-xs text-red-500">{configError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => addAutomation(t)}
                              className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => { setAddingTemplate(null); setConfigError(""); }}
                              className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {isAdding && !t.configField && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => addAutomation(t)}
                            className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            Add automation
                          </button>
                          <button
                            onClick={() => setAddingTemplate(null)}
                            className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Active automations */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Your Automations {automations.length > 0 && `(${automations.length})`}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : automations.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center">
              <div className="p-3 rounded-full bg-slate-100 inline-block mb-3">
                <Zap size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No automations yet</p>
              <p className="text-xs text-slate-400 mt-1">Add a template above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {automations.map((a) => (
                <div
                  key={a.id}
                  className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-4 transition-opacity ${!a.enabled ? "opacity-60" : ""}`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleAutomation(a)}
                    className="shrink-0 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={a.enabled ? "Disable" : "Enable"}
                  >
                    {a.enabled
                      ? <ToggleRight size={26} className="text-indigo-600" />
                      : <ToggleLeft size={26} />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800 truncate">{a.name}</span>
                      {a.trigger_config.category && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {a.trigger_config.category}
                        </span>
                      )}
                      {a.trigger_config.keyword && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          "{a.trigger_config.keyword}"
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span>{TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type}</span>
                      <span>→</span>
                      <span className="flex items-center gap-1">
                        {ACTION_ICONS[a.action_type]}
                        {ACTION_LABELS[a.action_type] ?? a.action_type}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-xs font-medium text-slate-700">{a.run_count} run{a.run_count !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-slate-400">
                      {a.last_run_at
                        ? new Date(a.last_run_at).toLocaleDateString()
                        : "Never run"}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteAutomation(a.id)}
                    className="shrink-0 text-slate-300 hover:text-red-500 transition-colors"
                    title="Delete automation"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Run history */}
        {runs.length > 0 && (
          <section>
            <button
              onClick={() => setShowRuns(!showRuns)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 hover:text-slate-700 transition-colors"
            >
              Run History ({runs.length})
              {showRuns ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showRuns && (
              <div className="space-y-2">
                {runs.map((run) => {
                  const auto = automations.find((a) => a.id === run.automation_id);
                  const isExpanded = expandedRun === run.id;
                  const flashcards = run.result?.flashcards as Array<{ question: string; answer: string }> | undefined;
                  const conceptMap = run.result?.conceptMap as { centralConcept: string } | undefined;

                  return (
                    <div key={run.id} className="bg-white rounded-xl border overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                        onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                      >
                        {run.status === "done" ? (
                          <CheckCircle size={15} className="text-green-500 shrink-0" />
                        ) : (
                          <XCircle size={15} className="text-red-500 shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-700 truncate">
                              {auto?.name ?? "Deleted automation"}
                            </span>
                            {run.trigger_title && (
                              <span className="text-xs text-slate-400 truncate hidden sm:block">
                                · {run.trigger_title}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <Clock size={10} />
                            {new Date(run.created_at).toLocaleString()}
                            {Array.isArray(run.result?.flashcards) && (
                              <span className="text-indigo-600">· {(run.result!.flashcards as unknown[]).length} flashcards</span>
                            )}
                            {run.result?.conceptMap != null && (
                              <span className="text-purple-600">· concept map ready</span>
                            )}
                          </div>
                        </div>

                        {(flashcards || conceptMap) && (
                          isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />
                        )}
                      </div>

                      {/* Expanded run — show generated content */}
                      {isExpanded && flashcards && flashcards.length > 0 && (
                        <div className="border-t px-4 py-3 bg-slate-50 space-y-2">
                          <p className="text-xs font-semibold text-slate-600 mb-2">Generated Flashcards</p>
                          {flashcards.map((card, i) => (
                            <div key={i} className="bg-white rounded-lg border p-3">
                              <p className="text-xs font-medium text-slate-700">Q: {card.question}</p>
                              <p className="text-xs text-slate-500 mt-1">A: {card.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {isExpanded && conceptMap && (
                        <div className="border-t px-4 py-3 bg-slate-50">
                          <p className="text-xs font-semibold text-slate-600 mb-2">Generated Concept Map</p>
                          <p className="text-xs text-slate-500">
                            Central concept: <span className="font-medium text-slate-700">{conceptMap.centralConcept}</span>
                            {" "}— open the Knowledge Base entry to view the full interactive map.
                          </p>
                        </div>
                      )}

                      {isExpanded && run.error && (
                        <div className="border-t px-4 py-3 bg-red-50">
                          <p className="text-xs text-red-600">{run.error}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Help footer */}
        <div className="mt-10 px-5 py-4 rounded-xl bg-indigo-50 border border-indigo-100">
          <p className="text-xs font-semibold text-indigo-800 mb-1">How automations work</p>
          <p className="text-xs text-indigo-600 leading-relaxed">
            When you add a URL or PDF, CorePragya checks your active automations and runs matching actions automatically.
            Results appear in the Run History above and as notifications in the bell icon.
            Automations also run hourly for any content added via email or RSS.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
