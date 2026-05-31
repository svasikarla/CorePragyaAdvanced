import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { MvpDocsJob } from "@/types/mvp-docs";
import MvpDocsDetailClient from "./MvpDocsDetailClient";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const metadata = { title: "MVP Docs Detail — CorePragya" };

export default async function MvpDocsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: row } = await supabaseAdmin
    .from("mvp_docs_jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (!row) notFound();

  const job = row as unknown as MvpDocsJob;

  return <MvpDocsDetailClient job={job} accessToken={session.access_token} />;
}
