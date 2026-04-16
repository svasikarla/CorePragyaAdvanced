import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jobStore } from "@/lib/research/store/job-store";
import { sseEmitter } from "@/lib/research/store/sse-emitter";

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

  // ── Auth ──────────────────────────────────────────────────────────────────
  // EventSource doesn't support custom headers, so we accept the token
  // either as an Authorization header OR as a ?token= query param.
  const authHeader = request.headers.get("authorization");
  const queryToken = request.nextUrl.searchParams.get("token");
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : queryToken;
  if (!rawToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = rawToken;
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const job = await jobStore.get(id);

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  // Ensure the job belongs to this user
  if (job.user_id !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send the current job snapshot immediately
      controller.enqueue(sseChunk("init", job));

      if (job.status === "done" || job.status === "error") {
        controller.close();
        return;
      }

      // Subscribe to live events from the in-process emitter
      const unsubscribe = sseEmitter.subscribe(id, (event, data) => {
        controller.enqueue(sseChunk(event, data));
        if (event === "complete" || event === "error") {
          unsubscribe();
          clearInterval(pollTimer);
          controller.close();
        }
      });

      // Polling fallback: re-read from Supabase every 2 s
      // Handles Vercel multi-instance where emitter is a no-op
      const pollTimer = setInterval(async () => {
        const current = await jobStore.get(id);
        if (!current) return;
        controller.enqueue(sseChunk("poll", current));
        if (current.status === "done" || current.status === "error") {
          unsubscribe();
          clearInterval(pollTimer);
          controller.close();
        }
      }, 2000);

      // Clean up when client disconnects
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
