"use client";

import { useContentCreationStore } from "@/store/content-creation-store";
import { PLATFORM_LABELS } from "@/types/content-creation";
import type { Platform, ContentTone } from "@/types/content-creation";
import type { Provider } from "@/types/research";
import { RESEARCH_MODELS } from "@/lib/research/models";
import { useState } from "react";

const PLATFORMS: Platform[] = [
  "medium",
  "linkedin_post",
  "linkedin_article",
  "blog",
  "twitter_thread",
  "substack",
  "devto",
];

const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  medium: "Long-form article",
  linkedin_post: "Short post, 700 char hook",
  linkedin_article: "LinkedIn Pulse article",
  blog: "SEO blog post",
  twitter_thread: "8–15 tweet thread",
  substack: "Newsletter edition",
  devto: "Technical tutorial",
};

const TONES: { value: ContentTone; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Authoritative & polished" },
  { value: "casual", label: "Casual", description: "Friendly & approachable" },
  { value: "technical", label: "Technical", description: "Precise & detailed" },
  { value: "educational", label: "Educational", description: "Clear & instructive" },
  { value: "conversational", label: "Conversational", description: "Like talking to a friend" },
  { value: "storytelling", label: "Storytelling", description: "Narrative-driven" },
];

interface Props {
  onSubmit: (token: string) => void;
  accessToken: string | null;
  isLoading: boolean;
}

export function ContentCreationForm({ onSubmit, accessToken, isLoading }: Props) {
  const { config, setConfig } = useContentCreationStore();
  const [activeProvider, setActiveProvider] = useState<Provider>(config.provider);

  const handleProviderChange = (provider: Provider) => {
    setActiveProvider(provider);
    const firstModel = RESEARCH_MODELS[provider][0].id;
    setConfig({ provider, model: firstModel });
  };

  const togglePlatform = (platform: Platform) => {
    const current = config.targetPlatforms;
    if (current.includes(platform)) {
      if (current.length === 1) return; // must select at least one
      setConfig({ targetPlatforms: current.filter((p) => p !== platform) });
    } else {
      setConfig({ targetPlatforms: [...current, platform] });
    }
  };

  const canSubmit =
    config.topic.trim().length >= 3 &&
    config.targetPlatforms.length > 0 &&
    accessToken &&
    !isLoading;

  return (
    <div className="space-y-6">
      {/* Topic */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Topic <span className="text-red-500">*</span>
        </label>
        <textarea
          value={config.topic}
          onChange={(e) => setConfig({ topic: e.target.value })}
          placeholder="e.g. 'Why most developers misunderstand async/await in JavaScript' or 'The future of AI in healthcare'"
          rows={3}
          maxLength={300}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">Min 3 characters</span>
          <span className="text-xs text-slate-400">{config.topic.length}/300</span>
        </div>
      </div>

      {/* Additional Context */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Additional Context <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={config.additionalContext}
          onChange={(e) => setConfig({ additionalContext: e.target.value })}
          placeholder="e.g. 'Focus on enterprise use cases, avoid Python examples'"
          maxLength={1000}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Target Platforms */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Target Platforms <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PLATFORMS.map((platform) => {
            const selected = config.targetPlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-semibold">{PLATFORM_LABELS[platform]}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{PLATFORM_DESCRIPTIONS[platform]}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {config.targetPlatforms.length} platform{config.targetPlatforms.length !== 1 ? "s" : ""} selected — one AI writer per platform, running in parallel
        </p>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Tone</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setConfig({ tone: t.value })}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                config.tone === t.value
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="text-xs font-semibold">{t.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Audience + Keywords */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Target Audience
          </label>
          <input
            type="text"
            value={config.targetAudience}
            onChange={(e) => setConfig({ targetAudience: e.target.value })}
            placeholder="e.g. Senior engineers, startup founders"
            maxLength={200}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Keywords / Hashtag Seeds
          </label>
          <input
            type="text"
            value={config.keywords}
            onChange={(e) => setConfig({ keywords: e.target.value })}
            placeholder="e.g. AI, productivity, startup"
            maxLength={300}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.includeCode}
            onChange={(e) => setConfig({ includeCode: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-violet-500 focus:ring-violet-500"
          />
          <span className="text-sm text-slate-700">Include code examples</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.searchMyKB}
            onChange={(e) => setConfig({ searchMyKB: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-violet-500 focus:ring-violet-500"
          />
          <span className="text-sm text-slate-700">Search my Knowledge Base</span>
        </label>
      </div>

      {/* AI Model */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">AI Model</label>
        <div className="flex gap-1 mb-3 border-b border-slate-200">
          {(["anthropic", "openai", "groq"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeProvider === p
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {RESEARCH_MODELS[activeProvider].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setConfig({ model: m.id })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                config.model === m.id
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {m.label}
              <span
                className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase ${
                  m.tier === "powerful"
                    ? "bg-violet-100 text-violet-700"
                    : m.tier === "fast"
                    ? "bg-green-100 text-green-700"
                    : m.tier === "reasoning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {m.tier}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => accessToken && onSubmit(accessToken)}
        className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading
          ? "Starting content creation…"
          : `Generate Content for ${config.targetPlatforms.length} Platform${config.targetPlatforms.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
