import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/** PATCH /api/bookmark  { id: string, bookmarked: boolean } */
export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let id: string, bookmarked: boolean;
  try {
    ({ id, bookmarked } = await request.json());
    if (!id || typeof bookmarked !== "boolean") throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("knowledgebase")
    .update({ is_bookmarked: bookmarked })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id, is_bookmarked: bookmarked });
}

/** GET /api/bookmark?only=true  — list bookmarked entries */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("knowledgebase")
    .select("id, title, category, summary_text, source_ref, source_type, created_at")
    .eq("user_id", user.id)
    .eq("is_bookmarked", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookmarks: data ?? [] });
}
