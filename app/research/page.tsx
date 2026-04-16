import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import ResearchPageClient from "./ResearchPageClient";

export const metadata = { title: "Research Intelligence | CorePragya" };

export default async function ResearchPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return <ResearchPageClient accessToken={session?.access_token ?? null} />;
}
