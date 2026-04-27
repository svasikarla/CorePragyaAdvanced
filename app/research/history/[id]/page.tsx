import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { jobStore } from "@/lib/research/store/job-store";
import JobDetailClient from "./JobDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await jobStore.get(id);
  const topic = job?.config?.topic ?? "Research Report";
  return { title: `${topic} | CorePragya` };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const job = await jobStore.get(id);
  if (!job) notFound();
  if (job.user_id !== user.id) notFound();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <JobDetailClient job={job} accessToken={session?.access_token ?? null} />
  );
}
