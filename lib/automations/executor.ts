/**
 * Automation executor — runs IF-THEN rules when KB content is added.
 *
 * Designed to run server-side after a KB insert. Each automation is checked
 * against the entry's metadata; matching ones execute their action directly
 * via Supabase and the Anthropic SDK (no internal HTTP round-trips).
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Public types ──────────────────────────────────────────────────────────────

export interface EntryContext {
  entryId: string;
  userId: string;
  sourceType: string; // 'url' | 'pdf' | 'rss' | 'email'
  category: string;
  title: string;
  summary: string;
}

export interface AutomationRow {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  run_count: number;
}

// ── Trigger matching ──────────────────────────────────────────────────────────

function matchesTrigger(automation: AutomationRow, entry: EntryContext): boolean {
  const { trigger_type, trigger_config } = automation;

  switch (trigger_type) {
    case "url_added":
      return entry.sourceType === "url";
    case "pdf_added":
      return entry.sourceType === "pdf";
    case "rss_article":
      return entry.sourceType === "rss";
    case "any_added":
      return true;
    case "category_match": {
      const cat = (trigger_config.category ?? "").trim().toLowerCase();
      return cat.length > 0 && entry.category.toLowerCase() === cat;
    }
    case "keyword_match": {
      const kw = (trigger_config.keyword ?? "").trim().toLowerCase();
      if (!kw) return false;
      return (
        entry.title.toLowerCase().includes(kw) ||
        entry.summary.toLowerCase().includes(kw)
      );
    }
    default:
      return false;
  }
}

// ── Action: generate flashcards ───────────────────────────────────────────────

async function generateFlashcards(
  entryId: string,
  userId: string
): Promise<Array<{ question: string; answer: string }>> {
  const { data: entry } = await supabaseAdmin
    .from("knowledgebase")
    .select("title, summary_text, summary_json, category")
    .eq("id", entryId)
    .eq("user_id", userId)
    .single();

  if (!entry) throw new Error("KB entry not found");

  const keyPoints: string[] = entry.summary_json?.key_points ?? [];
  const content = [
    entry.summary_text,
    keyPoints.length > 0 ? `Key points:\n${keyPoints.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 3000);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: `You generate study flashcards from knowledge base content.
Return ONLY a valid JSON array of exactly 5 objects: [{"question":"...","answer":"..."}]
Questions should test understanding, not just recall. Answers should be concise (1-3 sentences).`,
    messages: [
      {
        role: "user",
        content: `Generate 5 flashcards for this content:\n\nTitle: ${entry.title}\nCategory: ${entry.category}\n\n${content}`,
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]);
}

// ── Action: create concept map ────────────────────────────────────────────────

async function createConceptMap(
  entryId: string,
  userId: string
): Promise<{ centralConcept: string; nodes: unknown[]; edges: unknown[] }> {
  const { data: entry } = await supabaseAdmin
    .from("knowledgebase")
    .select("title, summary_text, summary_json, category")
    .eq("id", entryId)
    .eq("user_id", userId)
    .single();

  if (!entry) throw new Error("KB entry not found");

  const keyPoints: string[] = entry.summary_json?.key_points ?? [];
  const content = [entry.summary_text, keyPoints.join("\n")]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3000);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system: `You create concept maps from content. Return ONLY valid JSON:
{"centralConcept":"main topic","nodes":[{"id":"n1","label":"concept","description":"one sentence"}],"edges":[{"from":"n1","to":"n2","label":"relationship"}]}
Generate 5-7 nodes and 4-8 edges.`,
    messages: [
      {
        role: "user",
        content: `Create a concept map for:\n\nTitle: ${entry.title}\nCategory: ${entry.category}\n\n${content}`,
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { centralConcept: entry.title, nodes: [], edges: [] };
  return JSON.parse(match[0]);
}

// ── Action: notify ────────────────────────────────────────────────────────────

async function createNotification(
  userId: string,
  automationName: string,
  actionType: string,
  entry: EntryContext
): Promise<void> {
  const descriptions: Record<string, string> = {
    generate_flashcards: `Flashcards auto-generated for "${entry.title}". Open the Knowledge Base to study them.`,
    create_concept_map: `Concept map auto-created for "${entry.title}". Open the Knowledge Base to explore it.`,
    notify: `New ${entry.sourceType} added: "${entry.title}" (${entry.category})`,
    generate_flashcards_and_notify: `Flashcards generated for "${entry.title}" (${entry.category}).`,
  };

  await supabaseAdmin.from("proactive_alerts").insert({
    user_id: userId,
    type: `automation`,
    description: descriptions[actionType] ?? `Automation "${automationName}" triggered for "${entry.title}"`,
    source_node_id: entry.entryId,
    resolved_status: "pending",
  });
}

// ── Log run ───────────────────────────────────────────────────────────────────

async function logRun(
  automationId: string,
  userId: string,
  entry: EntryContext,
  status: "done" | "error",
  result?: unknown,
  error?: string
): Promise<void> {
  await supabaseAdmin.from("automation_runs").insert({
    automation_id: automationId,
    user_id: userId,
    trigger_kb_id: entry.entryId,
    trigger_title: entry.title,
    action_type: "logged",
    status,
    result: result ?? null,
    error: error ?? null,
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runAutomationsForEntry(entry: EntryContext): Promise<void> {
  // Fetch all enabled automations for this user
  const { data: automations, error } = await supabaseAdmin
    .from("automations")
    .select("*")
    .eq("user_id", entry.userId)
    .eq("enabled", true);

  if (error || !automations || automations.length === 0) return;

  for (const automation of automations as AutomationRow[]) {
    if (!matchesTrigger(automation, entry)) continue;

    let runStatus: "done" | "error" = "done";
    let result: unknown = null;
    let errorMsg: string | undefined;

    try {
      switch (automation.action_type) {
        case "generate_flashcards": {
          const flashcards = await generateFlashcards(entry.entryId, entry.userId);
          result = { flashcards };
          await createNotification(entry.userId, automation.name, "generate_flashcards", entry);
          break;
        }
        case "create_concept_map": {
          const conceptMap = await createConceptMap(entry.entryId, entry.userId);
          result = { conceptMap };
          await createNotification(entry.userId, automation.name, "create_concept_map", entry);
          break;
        }
        case "notify": {
          await createNotification(entry.userId, automation.name, "notify", entry);
          result = { notified: true };
          break;
        }
        case "generate_flashcards_and_notify": {
          const flashcards = await generateFlashcards(entry.entryId, entry.userId);
          result = { flashcards };
          await createNotification(entry.userId, automation.name, "generate_flashcards_and_notify", entry);
          break;
        }
      }

      // Update run count + last_run_at
      await supabaseAdmin
        .from("automations")
        .update({
          last_run_at: new Date().toISOString(),
          run_count: automation.run_count + 1,
        })
        .eq("id", automation.id);
    } catch (err: unknown) {
      runStatus = "error";
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Automation ${automation.id} (${automation.name}) failed:`, errorMsg);
    }

    // Log the run regardless of success/failure
    await logRun(automation.id, entry.userId, entry, runStatus, result, errorMsg).catch(
      (e) => console.error("Failed to log automation run:", e)
    );
  }
}
