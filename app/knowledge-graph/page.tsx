'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Play, Pause, Network, Sparkles, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Dynamic import to avoid SSR issues with three.js
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface GraphNode {
  id: string;
  name: string;
  category: string;
  sourceType: string;
  val: number;
  color: string;
  connections?: number;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  type: string;
  keywords?: string[];
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats?: {
    totalNodes: number;
    displayedNodes: number;
    totalLinks: number;
    displayedLinks: number;
  };
}

export default function KnowledgeGraphPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'2D' | '3D'>('2D');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  const graphRef = useRef<any>(null);
  const router = useRouter();

  // Fetch graph data
  useEffect(() => {
    fetchGraphData();
  }, []);

  // Auto-dismiss transient notices
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const fetchGraphData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/knowledge-graph/data', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch graph data');
      }

      const data = await response.json();
      setGraphData(data);

      // Auto-center graph after loading
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.zoomToFit(400);
        }
      }, 500);
    } catch (error) {
      console.error('Error fetching graph data:', error);
      setError('Failed to load knowledge graph. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateLinks = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/knowledge-graph/generate-links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          minSimilarity: 0.15,
          maxLinks: 1000,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setNotice({ type: 'error', msg: result.message || result.error || 'Failed to generate connections.' });
        return;
      }

      await fetchGraphData();
      setNotice({
        type: result.linksCreated > 0 ? 'success' : 'info',
        msg: result.message || `Generated ${result.linksCreated} connections.`,
      });
    } catch (error) {
      console.error('Error generating links:', error);
      setNotice({ type: 'error', msg: 'Failed to generate connections. Please try again.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    // Center camera on node
    if (graphRef.current && view === '2D') {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(2, 1000);
    }
  }, [view]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      if (view === '2D') {
        const currentZoom = graphRef.current.zoom();
        graphRef.current.zoom(currentZoom * 1.2, 500);
      }
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      if (view === '2D') {
        const currentZoom = graphRef.current.zoom();
        graphRef.current.zoom(currentZoom / 1.2, 500);
      }
    }
  };

  const handleResetView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(1000);
    }
  };

  const togglePause = () => {
    if (graphRef.current) {
      if (isPaused) {
        graphRef.current.resumeAnimation();
      } else {
        graphRef.current.pauseAnimation();
      }
      setIsPaused(!isPaused);
    }
  };

  const handleViewEntry = (nodeId: string) => {
    router.push(`/knowledge-base?highlight=${nodeId}`);
  };

  // Categories actually present in the data (drives the interactive legend).
  const presentCategories = useMemo(() => {
    const m = new Map<string, string>();
    graphData.nodes.forEach((n) => { if (!m.has(n.category)) m.set(n.category, n.color); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [graphData]);

  // Apply category filtering client-side (empty set = show all).
  const displayed = useMemo<GraphData>(() => {
    if (activeCategories.size === 0) return graphData;
    const nodes = graphData.nodes.filter((n) => activeCategories.has(n.category));
    const ids = new Set(nodes.map((n) => n.id));
    const linkId = (e: string | GraphNode) => (typeof e === 'string' ? e : e.id);
    const links = graphData.links.filter((l) => ids.has(linkId(l.source)) && ids.has(linkId(l.target)));
    return { nodes, links, stats: graphData.stats };
  }, [graphData, activeCategories]);

  const focusNode = (term: string) => {
    const t = term.trim().toLowerCase();
    if (!t) return;
    const node = displayed.nodes.find((n) => n.name.toLowerCase().includes(t));
    if (!node) { setNotice({ type: 'info', msg: `No entry matching "${term}"` }); return; }
    setSelectedNode(node);
    if (graphRef.current && view === '2D' && node.x != null && node.y != null) {
      graphRef.current.centerAt(node.x, node.y, 800);
      graphRef.current.zoom(2.5, 800);
    }
  };

  const toggleCategory = (cat: string) =>
    setActiveCategories((prev) => {
      const s = new Set(prev);
      if (s.has(cat)) s.delete(cat); else s.add(cat);
      return s;
    });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your knowledge graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <div className="text-destructive mb-4">⚠️ {error}</div>
        <Button onClick={fetchGraphData}>Retry</Button>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
        <Network className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Knowledge Graph Yet</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Add some content to your knowledge base to see connections between your entries.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/knowledge-base')}>
            Go to Knowledge Base
          </Button>
          <Button variant="outline" onClick={fetchGraphData}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="w-6 h-6" />
              Knowledge Graph
            </h1>
            <p className="text-sm text-muted-foreground">
              {displayed.nodes.length}
              {activeCategories.size > 0 ? ` of ${graphData.nodes.length}` : ''} entries · {' '}
              {displayed.links.length} connections
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') focusNode(search); }}
                placeholder="Find an entry…"
                className="h-9 w-44 rounded-md border border-input bg-background pl-8 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView(view === '2D' ? '3D' : '2D')}
            >
              {view === '2D' ? '3D View' : '2D View'}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={generateLinks}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Links
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/knowledge-base')}
            >
              Back to Knowledge Base
            </Button>
          </div>
        </div>
      </div>

      {/* Transient notice */}
      {notice && (
        <div
          className={`border-b ${
            notice.type === 'success'
              ? 'bg-green-50 border-green-100'
              : notice.type === 'error'
              ? 'bg-red-50 border-red-100'
              : 'bg-blue-50 border-blue-100'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
            <span
              className={
                notice.type === 'success'
                  ? 'text-green-700'
                  : notice.type === 'error'
                  ? 'text-red-700'
                  : 'text-blue-700'
              }
            >
              {notice.msg}
            </span>
            <button onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Graph Controls */}
      <div className="absolute top-24 right-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleResetView} title="Fit to Screen">
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={togglePause} title={isPaused ? 'Resume' : 'Pause'}>
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <Card className="absolute top-24 left-4 z-10 p-4 max-w-xs shadow-lg">
          <h3 className="font-semibold mb-2 line-clamp-2">{selectedNode.name}</h3>
          <div className="text-sm space-y-1 mb-3">
            <p>
              <strong>Category:</strong>{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: selectedNode.color + '20', color: selectedNode.color }}>
                {selectedNode.category}
              </span>
            </p>
            <p><strong>Source:</strong> {selectedNode.sourceType.toUpperCase()}</p>
            <p><strong>Connections:</strong> {selectedNode.connections || 0}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleViewEntry(selectedNode.id)}
            >
              View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </Button>
          </div>
        </Card>
      )}

      {/* Graph Visualization */}
      <div className="flex-1 relative">
        {view === '2D' ? (
          <ForceGraph2D
            ref={graphRef}
            graphData={displayed}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="val"
            nodeRelSize={6}
            linkWidth={link => (link as GraphLink).value * 2}
            linkColor={() => 'rgba(150, 150, 150, 0.3)'}
            onNodeClick={handleNodeClick}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;

              // Draw node circle
              ctx.fillStyle = node.color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val * 2, 0, 2 * Math.PI, false);
              ctx.fill();

              // Show labels readily — for well-connected hubs always, and for
              // everything once slightly zoomed in (was 1.5, which left a blank
              // dot-cloud at the default fit-zoom).
              if (globalScale > 0.8 || (node.connections ?? 0) >= 3) {
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth + fontSize * 0.4, fontSize * 1.2];

                // Draw label background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y + node.val * 2 + 2,
                  bckgDimensions[0],
                  bckgDimensions[1]
                );

                // Draw label text
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'white';
                ctx.fillText(label, node.x, node.y + node.val * 2 + fontSize * 0.7);
              }
            }}
          />
        ) : (
          <ForceGraph3D
            ref={graphRef}
            graphData={displayed}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="val"
            nodeRelSize={4}
            linkWidth={link => (link as GraphLink).value * 1.5}
            linkColor={() => 'rgba(150, 150, 150, 0.3)'}
            onNodeClick={handleNodeClick}
            enableNodeDrag={true}
            backgroundColor="#000000"
          />
        )}

        {/* Zero-links call to action */}
        {graphData.links.length === 0 && !isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Card className="pointer-events-auto p-5 max-w-sm text-center shadow-lg">
              <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-1">No connections yet</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Generate semantic links to reveal how your entries relate to each other.
              </p>
              <Button size="sm" onClick={generateLinks}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Connections
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Legend / category filter (reflects categories actually present) */}
      <div className="border-t p-3 bg-card">
        <div className="flex flex-wrap items-center gap-2 max-w-7xl mx-auto text-sm">
          <span className="font-semibold mr-1">Filter:</span>
          <button
            onClick={() => setActiveCategories(new Set())}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              activeCategories.size === 0 ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted'
            }`}
          >
            All
          </button>
          {presentCategories.map(([name, color]) => {
            const active = activeCategories.has(name);
            const anyActive = activeCategories.size > 0;
            return (
              <button
                key={name}
                onClick={() => toggleCategory(name)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active ? 'border-foreground bg-muted' : anyActive ? 'opacity-50 hover:opacity-100' : 'hover:bg-muted'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
