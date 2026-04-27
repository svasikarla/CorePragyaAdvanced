import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import ResearchHistoryClient from "./ResearchHistoryClient";
import { jobStore } from "@/lib/research/store/job-store";

export const metadata = { title: "Research History | CorePragya" };

export default async function ResearchHistoryPage() {
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

  // Fetch first page server-side for fast initial render
  const { jobs, total } = await jobStore.list(user.id, { limit: 20, offset: 0 });

  return (
    <ResearchHistoryClient
      initialJobs={jobs}
      initialTotal={total}
      accessToken={session?.access_token ?? null}
    />
  );
}
