import { createClient } from "@supabase/supabase-js";
import { anthropic, generateEmbeddings } from "@/lib/ai-clients";

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

interface KBSource {
  kb_id: string;
  title: string;
  category: string;
  similarity: number;
  source_url: string;
  source_type: string;
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
  try {
    ({ messages } = await request.json());
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  // Latest user message is the search query
  const latestUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!latestUserMsg) {
    return new Response(JSON.stringify({ error: "No user message found" }), { status: 400 });
  }
  const query = latestUserMsg.content.trim();

  // RAG: generate query embedding and search KB
  let sources: KBSource[] = [];
  let contextText = "";
  try {
    const [[queryEmbedding]] = await Promise.all([generateEmbeddings(query)]);

    const { data: chunks } = await supabaseAdmin.rpc("match_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: 0.45,
      match_count: 6,
    });

    if (chunks && chunks.length > 0) {
      const kbIds = [...new Set((chunks as any[]).map((c) => c.kb_id))];
      const { data: entries } = await supabaseAdmin
        .from("knowledgebase")
        .select("id, title, category, summary_text, source_ref, source_type")
        .in("id", kbIds)
        .eq("user_id", user.id);

      const entryMap = new Map((entries ?? []).map((e) => [e.id, e]));

      sources = (chunks as any[])
        .map((chunk) => {
          const entry = entryMap.get(chunk.kb_id);
          if (!entry) return null;
          return {
            kb_id: chunk.kb_id,
            chunk_text: chunk.chunk_text as string,
            title: entry.title,
            category: entry.category,
            similarity: chunk.similarity,
            source_url: entry.source_ref ?? "",
            source_type: entry.source_type ?? "unknown",
          };
        })
        .filter(Boolean) as KBSource[];

      contextText = sources
        .map((s, i) => `[${i + 1}] ${(s as any).chunk_text}`)
        .join("\n\n")
        .slice(0, 14000);
    }
  } catch (e) {
    console.error("RAG search failed:", e);
  }

  const systemPrompt = contextText
    ? `You are CorePragya, a personal AI assistant that answers questions exclusively from the user's own knowledge base.

KNOWLEDGE BASE CONTEXT:
${contextText}

RULES:
- Answer only from the context above.
- If the context does not contain the answer, say: "I don't have information about that in your knowledge base."
- Cite sources by referencing their position numbers like [1], [2] etc.
- Be concise and direct. Use markdown formatting (headers, bullets) when it improves clarity.
- Never fabricate facts not present in the context.`
    : `You are CorePragya, a personal AI assistant. The user's knowledge base returned no relevant results for this query. Politely let the user know that you couldn't find relevant information in their knowledge base and suggest they add related content to it.`;

  // Build Anthropic messages (strip sources from previous assistant messages)
  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Stream the response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
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

        // Send sources after text is done
        if (sources.length > 0) {
          send({
            type: "sources",
            sources: sources.map(({ kb_id, title, category, similarity, source_url, source_type }) => ({
              kb_id, title, category, similarity, source_url, source_type,
            })),
          });
        }

        send({ type: "done" });
      } catch (err) {
        console.error("Streaming error:", err);
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
