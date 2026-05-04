import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { techJobStore } from "@/lib/tech-research/store/job-store";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await techJobStore.get(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (job.status === "running" || job.status === "queued") {
    return NextResponse.json({ error: "Cannot delete an active job" }, { status: 409 });
  }

  await techJobStore.delete(id, user.id);
  return NextResponse.json({ success: true });
}
