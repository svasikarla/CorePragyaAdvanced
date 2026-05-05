import { createClient } from "@supabase/supabase-js";
import { anthropic } from "@/lib/ai-clients";
import { jobStore } from "@/lib/research/store/job-store";
import { reportToMarkdown } from "@/lib/research/export/markdown";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(reportMd: string, topic: string, audience: string): string {
  return `You are a research assistant helping a user explore and deepen their understanding of a research report.

REPORT CONTEXT — this is the complete report the user is working with:
---
${reportMd.slice(0, 20000)}
---

YOUR ROLE:
- Answer questions about the report's findings, sources, and conclusions
- Help the user explore specific sections in more depth
- Suggest follow-up questions or angles the report didn't cover
- Point out where coverage was thin or where the user should do additional research
- You may draw on your general knowledge to add context, but ALWAYS distinguish between what the report says and what you're adding from general knowledge
- Use phrases like "The report states..." for report content and "Beyond the report..." for additional context
- Be conversational and helpful — this is an exploration, not a test

REPORT DETAILS:
- Topic: ${topic}
- Audience: ${audience}

Never fabricate citations. If a user asks for a source not in the report, say so clearly.`;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let messages: ChatMessage[];
  let jobId: string;
  try {
    ({ messages, jobId } = await request.json());
    if (!Array.isArray(messages) || !jobId) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  // Load the research job — verify ownership
  const job = await jobStore.get(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: "Job not found" }), { status: 404 });
  }
  if (job.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  if (!job.report) {
    return new Response(JSON.stringify({ error: "No report available for this job" }), { status: 400 });
  }

  const reportMd = reportToMarkdown(job.report);
  const systemPrompt = buildSystemPrompt(reportMd, job.config.topic, job.config.audience);

  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages: anthropicMessages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "text", content: event.delta.text });
          }
        }

        send({ type: "done" });
      } catch (err) {
        console.error("Research chat streaming error:", err);
        send({ type: "error", message: "An error occurred while generating the response." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
