-- Create rss_feeds table
CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  rss_feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, rss_feed_id)
);

-- Create proactive_alerts table
CREATE TABLE IF NOT EXISTS proactive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  source_node_id UUID REFERENCES knowledgebase(id) ON DELETE CASCADE,
  new_news_id UUID REFERENCES knowledgebase(id) ON DELETE CASCADE,
  resolved_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trending_metrics table
CREATE TABLE IF NOT EXISTS trending_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name TEXT NOT NULL,
  view_count INTEGER DEFAULT 0,
  search_count INTEGER DEFAULT 0,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(entity_name, metric_date)
);

-- Add RLS policies for user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_subscriptions_select_policy ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_subscriptions_insert_policy ON user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_subscriptions_delete_policy ON user_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for proactive_alerts
ALTER TABLE proactive_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY proactive_alerts_select_policy ON proactive_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY proactive_alerts_update_policy ON proactive_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY proactive_alerts_delete_policy ON proactive_alerts
  FOR DELETE USING (auth.uid() = user_id);
