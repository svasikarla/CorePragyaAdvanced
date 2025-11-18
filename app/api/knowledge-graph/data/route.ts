import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Helper function to get category colors
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'Science': '#3b82f6',
    'Technology': '#8b5cf6',
    'AI': '#ec4899',
    'Business': '#f59e0b',
    'Health': '#10b981',
    'Education': '#06b6d4',
    'Politics': '#ef4444',
    'Environment': '#84cc16',
    'Arts': '#f97316',
    'Sports': '#6366f1',
    'Other': '#64748b',
    'Uncategorized': '#64748b',
  };
  return colors[category] || colors['Other'];
}

export async function GET(request: Request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters for pagination and filtering
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000');
    const category = searchParams.get('category');

    // Build query for nodes
    let nodesQuery = supabase
      .from('knowledgebase')
      .select('id, title, category, source_type, created_at, summary_json', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Apply category filter if provided
    if (category) {
      nodesQuery = nodesQuery.eq('category', category);
    }

    // Apply pagination
    const start = page * pageSize;
    const end = start + pageSize - 1;
    nodesQuery = nodesQuery.range(start, end);

    // Fetch nodes
    const { data: nodes, error: nodesError, count } = await nodesQuery;

    if (nodesError) {
      console.error('Error fetching nodes:', nodesError);
      throw nodesError;
    }

    // Fetch all links for the user
    const { data: links, error: linksError } = await supabase
      .from('knowledge_graph_links')
      .select('source_kb_id, target_kb_id, link_strength, link_type, shared_keywords')
      .eq('user_id', user.id);

    if (linksError) {
      console.error('Error fetching links:', linksError);
      throw linksError;
    }

    // Calculate connection counts for each node
    const connectionCounts: Record<string, number> = {};
    links?.forEach(link => {
      connectionCounts[link.source_kb_id] = (connectionCounts[link.source_kb_id] || 0) + 1;
      connectionCounts[link.target_kb_id] = (connectionCounts[link.target_kb_id] || 0) + 1;
    });

    // Format nodes for react-force-graph
    const formattedNodes = nodes?.map(node => ({
      id: node.id,
      name: node.title || 'Untitled',
      category: node.category || 'Uncategorized',
      sourceType: node.source_type,
      val: Math.max(1, (connectionCounts[node.id] || 0) / 2), // Node size based on connections
      color: getCategoryColor(node.category || 'Uncategorized'),
      connections: connectionCounts[node.id] || 0,
      createdAt: node.created_at,
    })) || [];

    // Format links for react-force-graph
    const formattedLinks = links?.map(link => ({
      source: link.source_kb_id,
      target: link.target_kb_id,
      value: link.link_strength || 0.5,
      type: link.link_type,
      keywords: link.shared_keywords || [],
    })) || [];

    // Filter out links where nodes don't exist (in case of pagination)
    const nodeIds = new Set(formattedNodes.map(n => n.id));
    const filteredLinks = formattedLinks.filter(
      link => nodeIds.has(link.source as string) && nodeIds.has(link.target as string)
    );

    // Return graph data
    const graphData = {
      nodes: formattedNodes,
      links: filteredLinks,
      stats: {
        totalNodes: count || 0,
        displayedNodes: formattedNodes.length,
        totalLinks: links?.length || 0,
        displayedLinks: filteredLinks.length,
        hasMore: count ? (start + formattedNodes.length) < count : false,
        page,
        pageSize,
      },
    };

    return NextResponse.json(graphData);
  } catch (error) {
    console.error('Error in knowledge-graph/data API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
