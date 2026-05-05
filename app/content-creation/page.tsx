import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ContentCreationPageClient from "./ContentCreationPageClient";

export const metadata = { title: "Content Creation — CorePragya" };

export default async function ContentCreationPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return <ContentCreationPageClient accessToken={session.access_token} />;
}
