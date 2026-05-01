"use client";

import { useState, useMemo } from "react";

interface Node { id: string; label: string; description: string; }
interface Edge { from: string; to: string; label: string; }
interface ConceptMapData {
  centralConcept: string;
  nodes: Node[];
  edges: Edge[];
}

interface Props { data: ConceptMapData; }

const W = 600;
const H = 420;
const CENTER_R = 44;
const NODE_R = 36;
const ORBIT_R = 155;

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function ConceptMapViewer({ data }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { centerX, centerY, nodePositions } = useMemo(() => {
    const cx = W / 2;
    const cy = H / 2;
    const positions: Record<string, { x: number; y: number }> = {};

    // Central node uses id "central"
    positions["central"] = { x: cx, y: cy };

    // Distribute other nodes on a circle
    const count = data.nodes.length;
    data.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      positions[node.id] = {
        x: cx + ORBIT_R * Math.cos(angle),
        y: cy + ORBIT_R * Math.sin(angle),
      };
    });

    return { centerX: cx, centerY: cy, nodePositions: positions };
  }, [data.nodes]);

  const hoveredNode = hovered
    ? data.nodes.find((n) => n.id === hovered)
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/30 overflow-hidden">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges */}
          {data.edges.map((edge, i) => {
            const from = nodePositions[edge.from] ?? nodePositions["central"];
            const to = nodePositions[edge.to] ?? nodePositions["central"];
            if (!from || !to) return null;

            // Shorten line so it doesn't overlap node circles
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const fromR = edge.from === "central" ? CENTER_R : NODE_R;
            const toR = (edge.to === "central" ? CENTER_R : NODE_R) + 6;
            const x1 = from.x + (dx / dist) * fromR;
            const y1 = from.y + (dy / dist) * fromR;
            const x2 = to.x - (dx / dist) * toR;
            const y2 = to.y - (dy / dist) * toR;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;

            return (
              <g key={i}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={mx} y={my - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#94a3b8"
                    className="select-none pointer-events-none"
                  >
                    {truncate(edge.label, 18)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Central node */}
          <g>
            <circle cx={centerX} cy={centerY} r={CENTER_R} fill="#4f46e5" />
            <foreignObject
              x={centerX - CENTER_R + 4}
              y={centerY - CENTER_R + 6}
              width={(CENTER_R - 4) * 2}
              height={(CENTER_R - 6) * 2}
            >
              <div
                style={{ fontSize: 10, color: "#fff", textAlign: "center", lineHeight: 1.2, fontWeight: 600 }}
              >
                {truncate(data.centralConcept, 30)}
              </div>
            </foreignObject>
          </g>

          {/* Outer nodes */}
          {data.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const isHovered = hovered === node.id;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  cx={pos.x} cy={pos.y} r={NODE_R}
                  fill={isHovered ? "#6366f1" : "#e0e7ff"}
                  stroke={isHovered ? "#4f46e5" : "#a5b4fc"}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{ transition: "all 0.15s" }}
                />
                <foreignObject
                  x={pos.x - NODE_R + 3}
                  y={pos.y - NODE_R + 6}
                  width={(NODE_R - 3) * 2}
                  height={(NODE_R - 6) * 2}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: isHovered ? "#fff" : "#3730a3",
                      textAlign: "center",
                      lineHeight: 1.2,
                      fontWeight: 600,
                    }}
                  >
                    {truncate(node.label, 28)}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover description */}
      <div className="min-h-[40px] px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-800">
        {hoveredNode
          ? <><span className="font-semibold">{hoveredNode.label}:</span> {hoveredNode.description}</>
          : <span className="text-indigo-400">Hover a node to see its description</span>}
      </div>

      {/* Edge legend */}
      <div className="flex flex-wrap gap-1.5">
        {data.edges.map((edge, i) => {
          const fromNode = data.nodes.find(n => n.id === edge.from);
          const toNode = data.nodes.find(n => n.id === edge.to);
          const fromLabel = fromNode?.label ?? edge.from;
          const toLabel = toNode?.label ?? edge.to;
          return (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {truncate(fromLabel, 12)} → {truncate(edge.label, 10)} → {truncate(toLabel, 12)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
