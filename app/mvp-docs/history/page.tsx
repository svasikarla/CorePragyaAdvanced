import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MvpDocsHistoryClient from "./MvpDocsHistoryClient";

export const metadata = { title: "MVP Docs History — CorePragya" };

export default async function MvpDocsHistoryPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return <MvpDocsHistoryClient accessToken={session.access_token} />;
}
