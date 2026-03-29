export interface DefaultFeed {
  name: string;
  url: string;
  category: string;
  description: string;
}

export const DEFAULT_FEED_CATALOG: DefaultFeed[] = [
  // AI / ML
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", category: "Artificial Intelligence", description: "Research and product updates from Google AI." },
  { name: "MIT Technology Review - AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", category: "Artificial Intelligence", description: "In-depth AI analysis from MIT." },
  { name: "The Verge - AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", category: "Artificial Intelligence", description: "AI news and product launches." },
  { name: "Wired - AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", category: "Artificial Intelligence", description: "AI coverage from Wired magazine." },
  { name: "Towards Data Science", url: "https://towardsdatascience.com/feed", category: "Artificial Intelligence", description: "Community-driven ML and data science tutorials." },

  // Technology
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Technology", description: "Breaking tech news and startup funding." },
  { name: "Hacker News (Best)", url: "https://hnrss.org/best", category: "Technology", description: "Top stories from the Hacker News community." },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Technology", description: "Deep tech analysis and reviews." },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Technology", description: "Mainstream tech, science, and culture." },

  // Science
  { name: "Nature News", url: "https://www.nature.com/nature.rss", category: "Science", description: "Latest research from Nature journal." },
  { name: "Science Daily", url: "https://www.sciencedaily.com/rss/all.xml", category: "Science", description: "Breaking science news across all disciplines." },

  // General / News
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "Technology", description: "BBC's technology news coverage." },
  { name: "Reuters Technology", url: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best", category: "Technology", description: "Global tech news from Reuters." },
];

/**
 * Returns default feeds whose category fuzzy-matches any of the given user interest categories.
 */
export function getFeedsForCategories(userCategories: string[]): DefaultFeed[] {
  const normalized = userCategories.map(c => c.toLowerCase());
  return DEFAULT_FEED_CATALOG.filter(feed => {
    const feedCat = feed.category.toLowerCase();
    return normalized.some(uc =>
      feedCat.includes(uc) || uc.includes(feedCat) ||
      // Handle common synonyms
      (uc.includes('ai') && feedCat.includes('artificial intelligence')) ||
      (uc.includes('artificial intelligence') && feedCat.includes('ai')) ||
      (uc.includes('ml') && feedCat.includes('artificial intelligence')) ||
      (uc.includes('tech') && feedCat.includes('technology')) ||
      (uc.includes('science') && feedCat.includes('science'))
    );
  });
}
