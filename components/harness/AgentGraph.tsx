'use client';
import { useMemo } from 'react';
import type { AgentNode } from '@/hooks/useHarnessSession';

const STATUS_COLOR: Record<string, string> = {
  idle: '#374151',
  running: '#2563eb',
  waiting: '#d97706',
  complete: '#16a34a',
  error: '#dc2626',
};

const STATUS_RING: Record<string, string> = {
  idle: 'stroke-gray-600',
  running: 'stroke-blue-500',
  waiting: 'stroke-amber-500',
  complete: 'stroke-green-600',
  error: 'stroke-red-600',
};

const ROLE_ABBREV: Record<string, string> = {
  ceo: 'CEO', cpo: 'CPO', cmo: 'CMO', cto: 'CTO', cfo: 'CFO',
  copywriter: 'CW', outreach: 'OR', pricing: 'PR', research: 'RS',
  'life-ceo': 'LCEO', 'growth-director': 'GD', 'health-director': 'HD',
  'finance-director': 'FD', 'relationships-director': 'RD', 'systems-director': 'SD',
  'shared-researcher': 'SR', 'shared-planner': 'SP',
};

interface LayoutNode {
  agent: AgentNode;
  x: number;
  y: number;
}

function buildLayout(agents: Record<string, AgentNode>): LayoutNode[] {
  const tierMap: Record<number, AgentNode[]> = {};
  for (const a of Object.values(agents)) {
    (tierMap[a.tier] ??= []).push(a);
  }
  const maxTier = Math.max(...Object.keys(tierMap).map(Number), 0);
  const W = 640;
  const ROW_H = 90;
  const NODE_W = 80;
  const result: LayoutNode[] = [];

  for (let t = 0; t <= maxTier; t++) {
    const row = tierMap[t] ?? [];
    const rowW = row.length * NODE_W;
    const startX = (W - rowW) / 2 + NODE_W / 2;
    row.forEach((agent, i) => {
      result.push({ agent, x: startX + i * NODE_W, y: 30 + t * ROW_H });
    });
  }
  return result;
}

interface Props {
  agents: Record<string, AgentNode>;
}

export default function AgentGraph({ agents }: Props) {
  const layout = useMemo(() => buildLayout(agents), [agents]);
  const posMap = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    for (const n of layout) m[n.agent.id] = { x: n.x, y: n.y };
    return m;
  }, [layout]);

  const maxTier = Math.max(...Object.values(agents).map(a => a.tier), 0);
  const svgH = 40 + (maxTier + 1) * 90;

  if (layout.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-subtle text-sm">
        Waiting for agents…
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 640 ${svgH}`}
      className="w-full"
      style={{ height: svgH, maxHeight: 400 }}
    >
      {/* Edges */}
      {layout.map(({ agent }) => {
        if (!agent.parentId || !posMap[agent.parentId]) return null;
        const p = posMap[agent.parentId];
        const c = posMap[agent.id];
        return (
          <line
            key={`edge-${agent.id}`}
            x1={p.x} y1={p.y + 18}
            x2={c.x} y2={c.y - 18}
            stroke="#cbd5e1"
            strokeWidth={1.5}
            strokeDasharray={agent.status === 'idle' ? '4 3' : undefined}
          />
        );
      })}

      {/* Nodes */}
      {layout.map(({ agent, x, y }) => {
        const label = ROLE_ABBREV[agent.role] ?? agent.role.slice(0, 4).toUpperCase();
        const isRunning = agent.status === 'running';
        return (
          <g key={agent.id} transform={`translate(${x},${y})`}>
            {isRunning && (
              <circle r={20} fill="none" className={`${STATUS_RING[agent.status]} animate-ping opacity-30`} strokeWidth={2} />
            )}
            <circle r={18} fill={STATUS_COLOR[agent.status]} />
            <circle r={18} fill="none" className={STATUS_RING[agent.status]} strokeWidth={2} />
            <text
              textAnchor="middle"
              dy="0.35em"
              fontSize={label.length > 3 ? 7 : 9}
              fill="white"
              fontWeight="600"
              fontFamily="monospace"
            >
              {label}
            </text>
            <text
              textAnchor="middle"
              y={26}
              fontSize={8}
              fill="#64748b"
              fontFamily="monospace"
            >
              {agent.role.length > 12 ? agent.role.slice(0, 11) + '…' : agent.role}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
