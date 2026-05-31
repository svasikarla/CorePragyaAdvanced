import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MvpDocsPageClient from "./MvpDocsPageClient";

export const metadata = { title: "MVP Docs — CorePragya" };

export default async function MvpDocsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();

  return <MvpDocsPageClient accessToken={session.access_token} user={user} />;
}
