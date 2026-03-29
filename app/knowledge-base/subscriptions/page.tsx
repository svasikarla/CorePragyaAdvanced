"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash, Rss, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SuggestedFeeds from "@/components/knowledge/SuggestedFeeds";

export default function SubscriptionsPage() {
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const fetchUserAndFeeds = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setUser(session.user);
    setAccessToken(session.access_token);

    const { data } = await supabase
      .from('user_subscriptions')
      .select('*, rss_feeds(*)')
      .eq('user_id', session.user.id);
      
    setFeeds(data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchUserAndFeeds();
  }, [fetchUserAndFeeds]);

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl || !newName) return;

    try {
      // 1. Ensure feed exists
      let feedId;
      const { data: existing } = await supabase.from('rss_feeds').select('id').eq('url', newUrl).single();
      
      if (existing) {
         feedId = existing.id;
      } else {
         const { data: newFeed } = await supabase.from('rss_feeds').insert({ url: newUrl, name: newName }).select('id').single();
         if (newFeed) feedId = newFeed.id;
      }

      if (feedId) {
         // 2. Subscribe user
         const { error } = await supabase.from('user_subscriptions').insert({ user_id: user.id, rss_feed_id: feedId });
         
         if (error) {
            toast({ title: "Error", description: "Already subscribed or error occurred.", variant: "destructive" });
         } else {
            toast({ title: "Subscribed", description: "Successfully added to your knowledge ingestion feeds." });
            setNewUrl("");
            setNewName("");
            fetchUserAndFeeds();
         }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeFeed = async (subId: string) => {
    await supabase.from('user_subscriptions').delete().eq('id', subId);
    setFeeds(feeds.filter(f => f.id !== subId));
    toast({ title: "Unsubscribed", description: "Removed custom feed." });
  };

  const ingestFeeds = async () => {
    if (!accessToken) return;
    setIngesting(true);
    try {
      const res = await fetch('/api/ingest-rss', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Ingestion Complete", description: `Processed ${data.processed_articles} new article(s) into your knowledge base.` });
      } else {
        toast({ title: "Ingestion Failed", description: data.error || "Something went wrong.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to run feed ingestion.", variant: "destructive" });
    } finally {
      setIngesting(false);
    }
  };

  return (
    <AppLayout user={user}>
      <div className="container py-8 max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-playfair text-2xl font-bold tracking-tight md:text-3xl">Intelligence Feeds</h1>
            <p className="text-muted-foreground mt-2">Manage your automated knowledge ingestion pipelines.</p>
          </div>
          {feeds.length > 0 && (
            <Button onClick={ingestFeeds} disabled={ingesting} className="bg-indigo-700 hover:bg-indigo-800">
              {ingesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {ingesting ? "Ingesting..." : "Fetch Latest Articles"}
            </Button>
          )}
        </div>
        
        {/* The new AI Suggestions Panel */}
        <SuggestedFeeds onSubscribeRecord={fetchUserAndFeeds} accessToken={accessToken} userId={user?.id} />

        <Card>
          <CardHeader>
             <CardTitle className="flex items-center gap-2"><Rss className="h-5 w-5" /> Add Specific Feed</CardTitle>
             <CardDescription>Manually subscribe to an industry blog by pasting its exact RSS XML URL.</CardDescription>
          </CardHeader>
          <CardContent>
             <form onSubmit={addFeed} className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                   <label className="text-sm font-medium">Feed Name</label>
                   <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Google AI Blog" required />
                </div>
                <div className="flex-1 space-y-2">
                   <label className="text-sm font-medium">RSS URL</label>
                   <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." required type="url" />
                </div>
                <Button type="submit" className="bg-indigo-700 hover:bg-indigo-800"><Plus className="w-4 h-4 mr-2" /> Subscribe</Button>
             </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Active Ingestions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading active feeds...</p> : (
               feeds.length > 0 ? (
                 <div className="space-y-4">
                   {feeds.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-4 border rounded-xl bg-slate-50/50">
                         <div>
                            <h4 className="font-medium text-slate-800">{sub.rss_feeds?.name}</h4>
                            <p className="text-sm text-muted-foreground">{sub.rss_feeds?.url}</p>
                         </div>
                         <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-700 h-8 w-8 p-0 round-full" onClick={() => removeFeed(sub.id)}>
                            <Trash className="w-4 h-4" />
                         </Button>
                      </div>
                   ))}
                 </div>
               ) : (
                 <p className="text-muted-foreground text-sm py-4 text-center border rounded-xl border-dashed">You are not subscribed to any feeds.</p>
               )
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
