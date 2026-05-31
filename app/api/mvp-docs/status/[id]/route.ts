import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mvpDocsJobStore } from "@/lib/mvp-docs/store/job-store";
import { mvpDocsSseEmitter } from "@/lib/mvp-docs/store/sse-emitter";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const encoder = new TextEncoder();

function sseChunk(event: string, data: object): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authHeader = request.headers.get("authorization");
  const queryToken = request.nextUrl.searchParams.get("token");
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : queryToken;
  if (!rawToken) return new Response("Unauthorized", { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(rawToken);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  let job;
  try {
    job = await mvpDocsJobStore.get(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!job) {
    return new Response(
      JSON.stringify({ error: "Job not found. Run the mvp_docs_jobs migration." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  if (job.user_id !== user.id) return new Response("Forbidden", { status: 403 });

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk("init", job));

      if (job.status === "done" || job.status === "error") {
        controller.close();
        return;
      }

      const unsubscribe = mvpDocsSseEmitter.subscribe(id, (event, data) => {
        controller.enqueue(sseChunk(event, data));
        if (event === "complete" || event === "error") {
          unsubscribe();
          clearInterval(pollTimer);
          controller.close();
        }
      });

      const pollTimer = setInterval(async () => {
        const current = await mvpDocsJobStore.get(id);
        if (!current) return;
        controller.enqueue(sseChunk("poll", current));
        if (current.status === "done" || current.status === "error") {
          unsubscribe();
          clearInterval(pollTimer);
          controller.close();
        }
      }, 2000);

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(pollTimer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
