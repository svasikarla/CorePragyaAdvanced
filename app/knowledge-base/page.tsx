"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { 
  Plus, Search, Filter, SlidersHorizontal, Lightbulb, Globe, 
  Bookmark, Trash2, ChevronRight, Mail, RefreshCw, FileText,
  AlertCircle, Info as InfoIcon
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase/client"
import { fetchKnowledgeEntries, KnowledgeStats, getSourceDisplay, getSourceIconName } from "@/lib/knowledge-utils"
import AppLayout from "@/components/layout/AppLayout"
import KnowledgeDisplay from "@/components/knowledge/KnowledgeDisplay"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import debounce from "lodash/debounce"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import PdfUploadDialog from "@/components/knowledge/PdfUploadDialog"

// Create a helper component to render the summary JSON as bullet points
const SummaryBullets = ({ summaryJson }) => {
  // If summaryJson is not available, fall back to plain text
  if (!summaryJson) {
    return null;
  }

  let allPoints = [];

  // Handle the expected format with key_points, main_ideas, and insights arrays
  if (typeof summaryJson === 'object') {
    // Check if it's the expected format with arrays
    if (Array.isArray(summaryJson.key_points) || 
        Array.isArray(summaryJson.main_ideas) || 
        Array.isArray(summaryJson.insights)) {
      
      const keyPoints = Array.isArray(summaryJson.key_points) ? summaryJson.key_points : [];
      const mainIdeas = Array.isArray(summaryJson.main_ideas) ? summaryJson.main_ideas : [];
      const insights = Array.isArray(summaryJson.insights) ? summaryJson.insights : [];
      
      allPoints = [...keyPoints, ...mainIdeas, ...insights];
    } 
    // Handle the numeric key format (1, 2, 3, etc.)
    else {
      // Convert numeric keys to an array of values
      allPoints = Object.keys(summaryJson)
        .filter(key => !isNaN(Number(key))) // Only include numeric keys
        .sort((a, b) => Number(a) - Number(b)) // Sort numerically
        .map(key => summaryJson[key]);
    }
  }
  
  // Limit to prevent overcrowding
  allPoints = allPoints.slice(0, 3);
  
  if (allPoints.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-2">
      {allPoints.map((point, index) => (
        <div key={index} className="flex items-start mb-1.5 last:mb-0">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 mr-1.5 shrink-0"></div>
          <p className="text-xs text-muted-foreground line-clamp-2">{point}</p>
        </div>
      ))}
    </div>
  );
};

// Update the initialEntries to include summaryJson for the mock data
const initialEntries = [
  {
    id: "1",
    title: "The Future of Artificial Intelligence in Education",
    source: "https://example.com/ai-education",
    summary:
      "This article explores how AI is transforming educational methodologies, enabling personalized learning experiences, and helping educators identify knowledge gaps. Key points include adaptive learning systems, automated grading, and AI tutors.",
    summaryJson: {
      key_points: [
        "AI enables personalized learning experiences",
        "Adaptive learning systems adjust to student needs",
        "Automated grading saves educator time"
      ],
      main_ideas: [
        "AI is transforming educational methodologies",
        "Technology helps identify knowledge gaps"
      ],
      insights: [
        "AI tutors provide 24/7 learning support"
      ]
    },
    date: "2023-04-15",
    type: "url",
    category: "Artificial Intelligence",
  },
  {
    id: "2",
    title: "Cognitive Science: Memory Formation and Retention",
    source: "https://example.com/cognitive-science",
    summary:
      "A comprehensive overview of how memories are formed, stored, and retrieved in the human brain. The article discusses the role of the hippocampus, the difference between short-term and long-term memory, and practical techniques to improve retention.",
    summaryJson: {
      key_points: [
        "Hippocampus plays crucial role in memory formation",
        "Short-term and long-term memory use different mechanisms",
        "Spaced repetition improves retention"
      ],
      main_ideas: [
        "Memory formation involves complex neural processes",
        "Different types of memories are stored differently"
      ],
      insights: [
        "Sleep is essential for memory consolidation"
      ]
    },
    date: "2023-03-22",
    type: "url",
    category: "Science",
  },
  {
    id: "3",
    title: "Weekly Research Update: Knowledge Mapping Techniques",
    source: "research@institute.edu",
    summary:
      "This email summarizes recent research on knowledge mapping techniques, including concept mapping, mind mapping, and knowledge graphs. It highlights how these techniques can be used to visualize complex relationships between ideas and enhance understanding.",
    summaryJson: {
      key_points: [
        "Concept mapping helps organize hierarchical knowledge",
        "Mind mapping is effective for brainstorming",
        "Knowledge graphs represent semantic relationships"
      ],
      main_ideas: [
        "Visual techniques enhance understanding of complex topics",
        "Different mapping methods serve different purposes"
      ],
      insights: [
        "Combining multiple mapping techniques yields best results"
      ]
    },
    date: "2023-05-01",
    type: "email",
    category: "Education",
  },
]

// Add a PDF upload component
const PdfUploadDialog = ({ isOpen, onClose, onUpload }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('Documents');
  const { toast } = useToast();
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      setFile(null);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file to upload",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Get the current session using Supabase client
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.access_token) {
        throw new Error('Authentication error. Please log in again.');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      
      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload PDF');
      }
      
      toast({
        title: "PDF uploaded successfully",
        description: "Your PDF has been processed and added to your knowledge base",
      });
      
      onUpload(result.data);
      onClose();
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload PDF Document</DialogTitle>
          <DialogDescription>
            Upload a PDF file to add to your knowledge base
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="pdf-file" className="text-sm font-medium">
                PDF File
              </label>
              <Input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="category" className="text-sm font-medium">
                Category
              </label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
                disabled={isUploading}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload PDF"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Helper function to get color based on category
const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'Science': return 'bg-blue-100 text-blue-800';
    case 'Technology': return 'bg-purple-100 text-purple-800';
    case 'Artificial Intelligence': return 'bg-indigo-100 text-indigo-800';
    case 'Business': return 'bg-green-100 text-green-800';
    case 'Health': return 'bg-red-100 text-red-800';
    case 'Education': return 'bg-yellow-100 text-yellow-800';
    case 'Politics': return 'bg-orange-100 text-orange-800';
    case 'Environment': return 'bg-emerald-100 text-emerald-800';
    case 'Arts': return 'bg-pink-100 text-pink-800';
    case 'Sports': return 'bg-lime-100 text-lime-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryColorValue = (category: string): string => {
  switch (category) {
    case 'Science': return '#dbeafe'; // blue-100
    case 'Technology': return '#f3e8ff'; // purple-100
    case 'Artificial Intelligence': return '#e0e7ff'; // indigo-100
    case 'Business': return '#dcfce7'; // green-100
    case 'Health': return '#fee2e2'; // red-100
    case 'Education': return '#fef9c3'; // yellow-100
    case 'Politics': return '#ffedd5'; // orange-100
    case 'Environment': return '#d1fae5'; // emerald-100
    case 'Arts': return '#fce7f3'; // pink-100
    case 'Sports': return '#ecfccb'; // lime-100
    default: return '#f3f4f6'; // gray-100
  }
};

// Add a debug component to check the structure of the entries
// Add this component temporarily for debugging
const DebugEntries = ({ entries }) => {
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div className="hidden">
      <pre>{JSON.stringify(entries[0]?.summaryJson, null, 2)}</pre>
    </div>
  );
};

export default function KnowledgeBase() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([]) // Initialize as empty array instead of undefined
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats>({
    totalEntries: 0,
    categoryCounts: {},
    recentEntries: [],
    topCategory: 'None',
    topCategoryCount: 0
  })
  const { toast } = useToast()
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  
  // Add all new state variables here, at the top level with other state declarations
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [rawText, setRawText] = useState("")
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isAddPdfOpen, setIsAddPdfOpen] = useState(false)
  
  // Create a debounced function for search - but we'll only use it for specific events
  const debouncedSetSearchQuery = useCallback(
    debounce((query) => {
      setDebouncedSearchQuery(query);
    }, 300),
    []
  )

  // Function to trigger search - this centralizes the search logic
  const triggerSearch = () => {
    if (searchQuery.trim() !== '') {
      setDebouncedSearchQuery(searchQuery);
    }
  }

  // Add this function to handle the Enter key press
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      triggerSearch();
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      await fetchKnowledgeBaseEntries(session.user.id)
      setLoading(false)
    }
    
    getUser()
  }, [router])

  const fetchKnowledgeBaseEntries = async (userId) => {
    try {
      const { entries, stats, error } = await fetchKnowledgeEntries(userId);
      
      console.log('Fetched entries:', entries);
      console.log('Stats:', stats);
      
      if (error) {
        console.error('Error from fetchKnowledgeEntries:', error);
        toast({
          title: "Error loading entries",
          description: "Failed to load your knowledge base entries.",
          variant: "destructive",
        });
        // Return early but ensure entries is set to an empty array
        setEntries([]);
        return;
      }
      
      // Make sure entries is always an array
      setEntries(entries || []);
      setKnowledgeStats(stats || {
        totalEntries: 0,
        categoryCounts: {},
        recentEntries: [],
        topCategory: 'None',
        topCategoryCount: 0
      });
    } catch (error) {
      console.error('Error in fetchKnowledgeBaseEntries:', error);
      // Ensure entries is set to an empty array on error
      setEntries([]);
      toast({
        title: "Error loading entries",
        description: "Failed to load your knowledge base entries.",
        variant: "destructive",
      });
    }
  };
  
  const handleSignOut = () => {
    supabase.auth.signOut().then(() => {
      window.location.href = "/login"
    })
  }

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsLoading(true)

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to add URLs');
      }

      console.log('Adding URL:', url);
      console.log('User ID:', session.user.id);

      // Call our API endpoint with the auth token
      const response = await fetch('/api/process-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url }),
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = 'Failed to process URL';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          console.error('Error parsing error response:', jsonError);
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      let responseData;
      try {
        const jsonResponse = await response.json();
        responseData = jsonResponse.data;
        
        console.log('Response data:', responseData);

        if (!responseData || !responseData.id || !responseData.summary_text) {
          throw new Error('Invalid response data from server');
        }
      } catch (jsonError) {
        console.error('Error parsing response:', jsonError);
        throw new Error('Failed to parse server response');
      }

      // Create a new entry for the UI
      const newEntry = {
        id: responseData.id,
        title: responseData.title || responseData.summary_text.split('.')[0] || 'Untitled', // Use title or first sentence as title with fallback
        source: url,
        summary: responseData.summary_text,
        summaryJson: responseData.summary_json, // Include the summary_json field
        date: new Date().toISOString().split("T")[0],
        type: "url",
        category: responseData.category || 'Uncategorized', // Include the category
      };

      console.log('New entry created:', newEntry);
      
      // Update the entries state with the new entry
      setEntries(prevEntries => [newEntry, ...prevEntries]);
      setUrl("");

      // Refresh the knowledge base to ensure we have the latest data
      if (user?.id) {
        await fetchKnowledgeBaseEntries(user.id);
      }

      toast({
        title: "URL added to Knowledge Base",
        description: "The content has been successfully summarized and added to your knowledge base.",
      });
    } catch (error) {
      console.error('Error adding URL:', error);
      toast({
        title: "Error adding URL",
        description: error.message || "Failed to add URL. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshFromEmail = async () => {
    setIsRefreshing(true);
    
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to refresh from email');
      }

      // Call our API endpoint with the auth token
      const response = await fetch('/api/refresh-from-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh from email');
      }

      const data = await response.json();
      
      // Refresh the knowledge base entries
      if (user?.id) {
        await fetchKnowledgeBaseEntries(user.id);
      }

      // Show success message with details
      toast({
        title: "Email Refresh Complete",
        description: data.message || `Processed ${data.processed} URLs from emails`,
      });
      
      // If there were any errors, show a more detailed message
      if (data.errors > 0) {
        toast({
          title: `${data.errors} errors occurred`,
          description: "Some URLs could not be processed. Check the console for details.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error refreshing from email:', error);
      toast({
        title: "Error refreshing from email",
        description: error.message || "Failed to refresh from email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('knowledgebase')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update UI
      setEntries(entries.filter((entry) => entry.id !== id));

      toast({
        title: "Entry removed",
        description: "The entry has been removed from your knowledge base.",
      });
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error removing entry",
        description: "Failed to remove the entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBookmarkEntry = (id: string) => {
    toast({
      title: "Entry bookmarked",
      description: "This feature will be available soon.",
    });
  };

  const getFilteredEntries = () => {
    // Ensure entries is always an array before filtering
    const entriesArray = entries || [];
    
    return entriesArray
      .filter((entry) => {
        // Text search filter - use debouncedSearchQuery instead
        const matchesSearch =
          entry.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          entry.summary.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

        // Category filter
        const matchesCategory = !selectedCategory || entry.category === selectedCategory;
        
        // Type filter
        const matchesType = typeFilter === 'all' || entry.type === typeFilter;

        return matchesSearch && matchesCategory && matchesType;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        } else if (sortOrder === 'oldest') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sortOrder === 'popular') {
          return (b.viewCount || 0) - (a.viewCount || 0);
        }
        return 0;
      });
  };

  const filteredEntries = entries ? getFilteredEntries() : [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  // Improve the SearchAndFilters component for better usability
  const SearchAndFilters = () => {
    const uniqueCategories = [...new Set(entries.map(entry => entry.category))].filter(Boolean);
    
    return (
      <div className="mb-4 space-y-3">
        <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="relative w-full md:w-64 flex">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search knowledge..."
                className="pl-9 h-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // We intentionally don't trigger search on every keystroke
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <Button 
              variant="outline" 
              className="ml-2 h-10" 
              onClick={triggerSearch}
            >
              Search
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10">
                  <Filter className="mr-2 h-4 w-4" />
                  <span>Type: {typeFilter === 'all' ? 'All' : typeFilter}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                  All Types
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('url')}>
                  Web Content
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('email')}>
                  Email Content
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('pdf')}>
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  <span>Sort: {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Popular'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setSortOrder('newest')}>
                  Newest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder('oldest')}>
                  Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder('popular')}>
                  Most Viewed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {uniqueCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={`h-8 px-3 rounded-full ${selectedCategory === null ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
            >
              All Categories
            </Button>
            {uniqueCategories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="h-8 px-3 rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // More compact empty state
  const EmptyState = () => {
    return (
      <Card className="flex flex-col items-center justify-center p-6 text-center">
        {searchQuery ? (
          <>
            <div className="rounded-full bg-amber-100 p-2">
              <Search className="h-4 w-4 text-amber-700" />
            </div>
            <h3 className="mt-3 font-rasa text-base font-bold">No entries found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              No entries match your search query. Try a different search term or clear filters.
            </p>
            <Button 
              variant="outline" 
              className="mt-3 h-8 text-xs"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(null);
                setTypeFilter('all');
              }}
            >
              Clear All Filters
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-full bg-indigo-100 p-2">
              <Lightbulb className="h-4 w-4 text-indigo-700" />
            </div>
            <h3 className="mt-3 font-rasa text-base font-bold">Your knowledge base is empty</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Start building your knowledge base by adding URLs or importing from email.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Card className="bg-gradient-to-br from-indigo-50 to-white">
                <CardContent className="p-3">
                  <div className="flex flex-col items-center text-center">
                    <Globe className="h-6 w-6 text-indigo-700 mb-1" />
                    <h4 className="font-medium text-sm">Add Web Content</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                      Summarize and save articles from the web
                    </p>
                    <Button 
                      size="sm" 
                      className="w-full h-7 text-xs"
                      onClick={() => document.getElementById('url-input')?.focus()}
                    >
                      Add URL
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-indigo-50 to-white">
                <CardContent className="p-3">
                  <div className="flex flex-col items-center text-center">
                    <Mail className="h-6 w-6 text-indigo-700 mb-1" />
                    <h4 className="font-medium text-sm">Import from Email</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                      Extract knowledge from your emails
                    </p>
                    <Button 
                      size="sm" 
                      className="w-full h-7 text-xs"
                      onClick={handleRefreshFromEmail}
                    >
                      Connect Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-indigo-50 to-white">
                <CardContent className="p-3">
                  <div className="flex flex-col items-center text-center">
                    <FileText className="h-6 w-6 text-indigo-700 mb-1" />
                    <h4 className="font-medium text-sm">Upload PDF</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                      Upload and summarize PDF documents
                    </p>
                    <Button 
                      size="sm" 
                      className="w-full h-7 text-xs"
                      onClick={() => setIsAddPdfOpen(true)}
                    >
                      Upload PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Card>
    );
  };

  // Add this function to handle the Read More button click
  const handleReadMore = async (entry) => {
    setSelectedEntry(entry);
    setIsDetailOpen(true);
    setIsLoadingDetail(true);
    
    try {
      // Fetch the raw_text from Supabase
      const { data, error } = await supabase
        .from('knowledgebase')
        .select('raw_text')
        .eq('id', entry.id)
        .single();
      
      if (error) throw error;
      
      // Format the raw text - split into paragraphs
      const formattedText = data.raw_text 
        ? data.raw_text
            .split('\n')
            .filter(para => para.trim().length > 0)
            .join('\n\n')
        : "No content available";
      
      setRawText(formattedText);
    } catch (error) {
      console.error('Error fetching entry details:', error);
      setRawText("Failed to load content. Please try again.");
      toast({
        title: "Error loading content",
        description: "Could not load the full content for this entry.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Function to handle PDF upload
  const handleAddPdf = (newEntry) => {
    setEntries(prevEntries => [newEntry, ...prevEntries]);
    // Remove this line as filteredEntries is computed, not a state variable
    // setFilteredEntries(prevEntries => [newEntry, ...prevEntries]);
  };

  return (
    <AppLayout user={user}>
      <div className="container py-6 px-4 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          
          {/* Add this notice */}
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-800">Notice</h3>
                <p className="text-xs text-amber-700 mt-1">
                  PDF uploads are temporarily disabled while we optimize token usage. 
                  Please use URL import or email import instead.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Knowledge
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsAddUrlOpen(true)}>
                    <Globe className="mr-2 h-4 w-4" />
                    Add URL
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    disabled={true} // Disable the PDF upload option
                    className="text-muted-foreground cursor-not-allowed"
                    onClick={(e) => e.preventDefault()}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Upload PDF
                    <span className="ml-2 text-xs text-red-500">(Temporarily unavailable)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRefreshFromEmail}>
                    <Mail className="mr-2 h-4 w-4" />
                    Import from Email
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Knowledge Stats Dashboard - only show if entries exist */}
        {entries && entries.length > 0 && <KnowledgeDisplay stats={knowledgeStats} compact={true} />}

        <div className="grid gap-6 mb-8 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <Globe className="mr-2 h-5 w-5 text-indigo-600" />
                Add Web Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUrl} className="flex space-x-2">
                <Input
                  id="url-input"
                  type="url"
                  placeholder="Paste a URL to summarize..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5 text-indigo-600" />
                Import from Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Import and summarize content from your connected email accounts.
              </p>
              <Button onClick={handleRefreshFromEmail} disabled={isRefreshing} className="w-full">
                {isRefreshing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing from Email
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Refresh from Email Shared with CorePragya
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <SearchAndFilters />

        {filteredEntries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map((entry) => (
              <Card 
                key={entry.id} 
                className="overflow-hidden transition-all hover:shadow-md flex flex-col h-full border-l-4"
                style={{ borderLeftColor: getCategoryColorValue(entry.category) }}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-2 text-base font-medium group-hover:text-indigo-700 transition-colors">
                      {entry.title}
                    </CardTitle>
                    <div className="flex space-x-1 ml-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                        onClick={() => handleBookmarkEntry(entry.id)}
                      >
                        <Bookmark className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getCategoryColor(entry.category)}`}>
                      {entry.category}
                    </span>
                    {entry.type === "url" ? (
                      <Link 
                        href={entry.source} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                      >
                        <Globe className="mr-1 h-3 w-3" /> Web
                      </Link>
                    ) : entry.type === "email" ? (
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                        <Mail className="mr-1 h-3 w-3" /> Email
                      </span>
                    ) : entry.type === "pdf" ? (
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                        <FileText className="mr-1 h-3 w-3" /> PDF
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                        <Lightbulb className="mr-1 h-3 w-3" /> Source
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-grow">
                  {entry.summaryJson ? (
                    <SummaryBullets summaryJson={entry.summaryJson} />
                  ) : (
                    <p className="line-clamp-3 text-sm text-muted-foreground">{entry.summary}</p>
                  )}
                </CardContent>
                <CardFooter className="p-4 pt-2 flex justify-between items-center border-t mt-auto">
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString()}
                  </div>
                  <Button 
                    variant="link" 
                    className="h-8 p-0 text-indigo-700"
                    onClick={() => handleReadMore(entry)}
                  >
                    Read More <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      {selectedEntry && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{selectedEntry.title}</DialogTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getCategoryColor(selectedEntry.category)}`}>
                  {selectedEntry.category}
                </span>
                {selectedEntry.type === "url" ? (
                  <Link 
                    href={selectedEntry.source} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                  >
                    <Globe className="mr-1 h-3 w-3" /> Source
                  </Link>
                ) : selectedEntry.type === "email" ? (
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                    <Mail className="mr-1 h-3 w-3" /> Email
                  </span>
                ) : selectedEntry.type === "pdf" ? (
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                    <FileText className="mr-1 h-3 w-3" /> PDF
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                    <Lightbulb className="mr-1 h-3 w-3" /> Source
                  </span>
                )}
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                  {new Date(selectedEntry.date).toLocaleDateString()}
                </span>
              </div>
            </DialogHeader>
            
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2">Summary</h3>
              <div className="bg-gray-50 p-3 rounded-md mb-4">
                {selectedEntry.metadata?.processing_note && (
                  <div className="text-xs text-amber-600 mb-2">
                    <InfoIcon className="h-3 w-3 inline mr-1" />
                    {selectedEntry.metadata.processing_note}
                  </div>
                )}
                {selectedEntry.summaryJson ? (
                  <SummaryBullets summaryJson={selectedEntry.summaryJson} />
                ) : (
                  <p className="text-sm text-muted-foreground">{selectedEntry.summary}</p>
                )}
              </div>
              
              <h3 className="text-sm font-semibold mb-2">Full Content</h3>
              {isLoadingDetail ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  {rawText.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="mb-3">{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      <PdfUploadDialog
        isOpen={isAddPdfOpen}
        onClose={() => setIsAddPdfOpen(false)}
        onUpload={handleAddPdf}
      />
    </AppLayout>
  )
}
