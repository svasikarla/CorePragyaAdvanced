"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  name: string;
  url: string;
  description: string;
  category: string;
}

interface SuggestedFeedsProps {
  onSubscribeRecord: () => void;
  accessToken: string | null;
  userId: string | null;
}

export default function SuggestedFeeds({ onSubscribeRecord, accessToken, userId }: SuggestedFeedsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        if (!accessToken) return;

        const res = await fetch('/api/suggest-feeds', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
             setSuggestions(data.suggestions);
             setTopics(data.topics_analyzed);
          }
        }
      } catch (err) {
        console.error("Failed to load suggestions", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, [accessToken]);

  const handleSubscribe = async (feed: Suggestion) => {
    try {
      setSubscribing(feed.url);

      // 1. Ensure feed exists in system
      let feedId;
      const { data: existing } = await supabase.from('rss_feeds').select('id').eq('url', feed.url).single();

      if (existing) {
         feedId = existing.id;
      } else {
         const { data: newFeed } = await supabase.from('rss_feeds').insert({ url: feed.url, name: feed.name }).select('id').single();
         if (newFeed) feedId = newFeed.id;
      }

      if (feedId) {
         // 2. Subscribe user
         const { error } = await supabase.from('user_subscriptions').insert({ user_id: userId, rss_feed_id: feedId });
         
         if (error) {
            toast({ title: "Note", description: "You are already subscribed to this feed." });
         } else {
            toast({ title: "Subscribed", description: `Successfully added ${feed.name} to your ingestion feeds.` });
            // Remove from suggestions array to cleanup UX
            setSuggestions(prev => prev.filter(s => s.url !== feed.url));
            onSubscribeRecord(); // Trigger parent refresh
         }
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to subscribe.", variant: "destructive" });
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-indigo-100 bg-indigo-50/30">
        <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-400" />
          <p>Analyzing your Knowledge Graph to find the perfect feeds...</p>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          Curated For You
        </CardTitle>
        <CardDescription>
          Based on your research in <span className="font-semibold">{topics.join(", ")}</span>, our AI recommends adding these highly-reliable publisher feeds to your Knowledge Base.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((feed, idx) => (
            <div key={idx} className="flex flex-col justify-between p-4 rounded-xl border bg-white shadow-sm hover:border-indigo-200 transition-colors">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm leading-none">{feed.name}</h4>
                  <Badge variant="secondary" className="text-[10px] bg-slate-100">{feed.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{feed.description}</p>
              </div>
              
              <Button 
                onClick={() => handleSubscribe(feed)} 
                variant="outline" 
                size="sm" 
                className="w-full text-xs text-indigo-700 hover:bg-indigo-50"
                disabled={subscribing === feed.url}
              >
                {subscribing === feed.url ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                ) : (
                  <Plus className="h-3 w-3 mr-2" />
                )}
                1-Click Subscribe
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
