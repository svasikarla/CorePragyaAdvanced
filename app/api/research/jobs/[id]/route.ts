import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jobStore } from "@/lib/research/store/job-store";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ── Guard: don't delete an active job ────────────────────────────────────
  const job = await jobStore.get(id);
  if (!job) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (job.user_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (job.status === "running" || job.status === "queued") {
    return NextResponse.json(
      { error: "Cannot delete a job that is still running" },
      { status: 409 }
    );
  }

  try {
    await jobStore.delete(id, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
