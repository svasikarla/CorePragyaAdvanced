import { supabase } from "@/lib/supabase/client"

export interface KnowledgeStats {
  totalEntries: number;
  categoryCounts: Record<string, number>;
  recentEntries: any[];
  topCategory: string;
  topCategoryCount: number;
}

export async function fetchKnowledgeEntries(userId: string) {
  try {
    console.log('Fetching knowledge entries for user:', userId);
    
    // Fetch all entries for the user
    const { data, error } = await supabase
      .from('knowledgebase')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching knowledge entries:', error);
      return { 
        entries: [],
        stats: {
          totalEntries: 0,
          categoryCounts: {},
          recentEntries: [],
          topCategory: 'None',
          topCategoryCount: 0
        },
        error
      };
    }

    console.log('Fetched knowledge entries count:', data?.length || 0);

    // If no data, return empty stats
    if (!data || data.length === 0) {
      return { 
        entries: [],
        stats: {
          totalEntries: 0,
          categoryCounts: {},
          recentEntries: [],
          topCategory: 'None',
          topCategoryCount: 0
        },
        error: null
      };
    }

    // Format the entries
    const formattedEntries = data.map(entry => ({
      id: entry.id,
      title: entry.title || 'Untitled',
      category: entry.category || 'Uncategorized',
      created_at: entry.created_at,
      summary: entry.summary_text || '',
      summaryJson: entry.summary_json || null,
      source: entry.source_ref || entry.source_type || 'Unknown',
      date: new Date(entry.created_at).toISOString().split("T")[0],
      type: entry.source_type || 'url'
    }));

    // Count entries by category
    const categoryCounts: Record<string, number> = {};
    data.forEach(entry => {
      const category = entry.category || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Find the top category
    let topCategoryEntry: [string, number] = ['None', 0];
    Object.entries(categoryCounts).forEach(([category, count]) => {
      if (count > topCategoryEntry[1]) {
        topCategoryEntry = [category, count];
      }
    });

    const stats = {
      totalEntries: data.length,
      categoryCounts,
      recentEntries: formattedEntries.slice(0, 5),
      topCategory: topCategoryEntry[0],
      topCategoryCount: topCategoryEntry[1]
    };

    return { entries: formattedEntries, stats, error: null };
  } catch (error) {
    console.error('Error fetching knowledge entries:', error);
    return { 
      entries: [],
      stats: {
        totalEntries: 0,
        categoryCounts: {},
        recentEntries: [],
        topCategory: 'None',
        topCategoryCount: 0
      },
      error
    };
  }
}

// Helper function to get a readable source display
export function getSourceDisplay(entry: any): string {
  if (!entry) return 'Unknown';
  
  switch (entry.type) {
    case 'url':
      try {
        const url = new URL(entry.source);
        return url.hostname;
      } catch (e) {
        return entry.source;
      }
    case 'email':
      return entry.source;
    case 'pdf':
      return `PDF: ${entry.source}`;
    default:
      return entry.source;
  }
}

// Helper function to get an icon name based on source type
export function getSourceIconName(type: string): string {
  switch (type) {
    case 'url':
      return 'Globe';
    case 'email':
      return 'Mail';
    case 'pdf':
      return 'FileText';
    default:
      return 'File';
  }
}
