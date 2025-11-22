'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Play, Pause, Network, Sparkles } from 'lucide-react';
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

  const graphRef = useRef<any>();
  const router = useRouter();

  // Fetch graph data
  useEffect(() => {
    fetchGraphData();
  }, []);

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

      if (!response.ok) {
        throw new Error('Failed to generate links');
      }

      const result = await response.json();

      if (result.success) {
        // Refresh graph data
        await fetchGraphData();
        alert(`✓ Successfully generated ${result.linksCreated} connections!`);
      }
    } catch (error) {
      console.error('Error generating links:', error);
      setError('Failed to generate connections. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNodeClick = useCallback((node: GraphNode) => {
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
              {graphData.stats?.displayedNodes || graphData.nodes.length} entries · {' '}
              {graphData.stats?.displayedLinks || graphData.links.length} connections
            </p>
          </div>

          <div className="flex gap-2">
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
            graphData={graphData}
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

              // Draw label if zoomed in enough
              if (globalScale > 1.5) {
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
            graphData={graphData}
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
      </div>

      {/* Legend */}
      <div className="border-t p-4 bg-card">
        <div className="flex flex-wrap gap-4 max-w-7xl mx-auto text-sm">
          <div className="font-semibold mr-2">Categories:</div>
          {[
            { name: 'Science', color: '#3b82f6' },
            { name: 'Technology', color: '#8b5cf6' },
            { name: 'AI', color: '#ec4899' },
            { name: 'Business', color: '#f59e0b' },
            { name: 'Health', color: '#10b981' },
            { name: 'Education', color: '#06b6d4' },
            { name: 'Politics', color: '#ef4444' },
            { name: 'Environment', color: '#84cc16' },
          ].map(({ name, color }) => (
            <div key={name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
