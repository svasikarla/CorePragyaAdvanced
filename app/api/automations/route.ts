import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(auth.split(" ")[1]);
  return user ?? null;
}

/** GET /api/automations — list user's automations + recent runs */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: automations }, { data: runs }] = await Promise.all([
    supabaseAdmin
      .from("automations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("automation_runs")
      .select("id, automation_id, trigger_title, action_type, status, result, error, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({ automations: automations ?? [], runs: runs ?? [] });
}

/** POST /api/automations — create a new automation */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name: string;
    trigger_type: string;
    trigger_config: Record<string, string>;
    action_type: string;
    action_config?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const VALID_TRIGGERS = new Set([
    "url_added", "pdf_added", "rss_article", "any_added",
    "category_match", "keyword_match",
  ]);
  const VALID_ACTIONS = new Set([
    "generate_flashcards", "create_concept_map", "notify",
    "generate_flashcards_and_notify",
  ]);

  if (!VALID_TRIGGERS.has(body.trigger_type) || !VALID_ACTIONS.has(body.action_type)) {
    return NextResponse.json({ error: "Invalid trigger or action type" }, { status: 400 });
  }

  // Limit: 10 automations per user
  const { count } = await supabaseAdmin
    .from("automations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "Maximum 10 automations per user" }, { status: 429 });
  }

  const { data, error } = await supabaseAdmin
    .from("automations")
    .insert({
      user_id: user.id,
      name: body.name.trim().slice(0, 100),
      trigger_type: body.trigger_type,
      trigger_config: body.trigger_config ?? {},
      action_type: body.action_type,
      action_config: body.action_config ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ automation: data }, { status: 201 });
}
