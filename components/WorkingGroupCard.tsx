'use client';
import type { AgentId, AgentState, ArtifactSet } from '@/types';

interface Props {
  id: 'copywriter' | 'outreach' | 'pricing' | 'research';
  state: AgentState;
  artifacts: ArtifactSet;
  label: string;
  onViewArtifact: (tab: string) => void;
}

const COLORS: Record<string, { border: string; badge: string; dot: string }> = {
  copywriter: { border: 'border-pink-900/40', badge: 'text-pink-400 bg-pink-400/10', dot: 'bg-pink-400' },
  outreach: { border: 'border-cyan-900/40', badge: 'text-cyan-400 bg-cyan-400/10', dot: 'bg-cyan-400' },
  pricing: { border: 'border-teal-900/40', badge: 'text-teal-400 bg-teal-400/10', dot: 'bg-teal-400' },
  research: { border: 'border-indigo-900/40', badge: 'text-indigo-400 bg-indigo-400/10', dot: 'bg-indigo-400' },
};

function ArtifactSummary({
  id,
  artifacts,
  onView,
}: {
  id: Props['id'];
  artifacts: ArtifactSet;
  onView: () => void;
}) {
  if (id === 'copywriter' && artifacts.copywriter) {
    const a = artifacts.copywriter;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-white">"{a.landingPageCopy.heroHeadline}"</p>
        <p className="text-xs text-gray-400">
          {a.emailSequence.length} emails · {a.adVariants.length} ad variants
        </p>
        <button onClick={onView} className="text-xs text-pink-400 hover:text-pink-300">
          View full copy ↓
        </button>
      </div>
    );
  }

  if (id === 'outreach' && artifacts.outreach) {
    const a = artifacts.outreach;
    const channels = [...new Set(a.messages.map(m => m.channel))];
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-white">{a.messages.length} messages ready</p>
        <p className="text-xs text-gray-400">
          {channels.join(' + ')} · {[...new Set(a.messages.map(m => m.personaType.split(' ')[0]))].slice(0, 3).join(', ')}…
        </p>
        <button onClick={onView} className="text-xs text-cyan-400 hover:text-cyan-300">
          View messages ↓
        </button>
      </div>
    );
  }

  if (id === 'pricing' && artifacts.pricing) {
    const a = artifacts.pricing;
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          {a.tiers.map((t, i) => (
            <div key={i} className={`text-xs px-2 py-1 rounded border ${t.isHighlighted ? 'border-teal-500 text-teal-300' : 'border-gray-700 text-gray-400'}`}>
              {t.name}<br />{t.price}
            </div>
          ))}
        </div>
        <button onClick={onView} className="text-xs text-teal-400 hover:text-teal-300">
          Preview pricing page ↓
        </button>
      </div>
    );
  }

  if (id === 'research' && artifacts.research) {
    const a = artifacts.research;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-white">{a.questions.length} discovery questions</p>
        <p className="text-xs text-gray-400">
          Themes: {[...new Set(a.questions.map(q => q.theme))].slice(0, 3).join(', ')}
        </p>
        <button onClick={onView} className="text-xs text-indigo-400 hover:text-indigo-300">
          View guide ↓
        </button>
      </div>
    );
  }

  return null;
}

export default function WorkingGroupCard({ id, state, artifacts, label, onViewArtifact }: Props) {
  const colors = COLORS[id];
  const charCount = state.streamBuffer.length;

  return (
    <div className={`bg-gray-900 border ${colors.border} rounded-xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            state.status === 'idle' ? 'bg-gray-700' :
            state.status === 'running' ? `${colors.dot} animate-pulse-dot` :
            state.status === 'complete' ? 'bg-green-400' : 'bg-red-400'
          }`} />
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.badge}`}>
            {label}
          </span>
        </div>
        {state.completedAt && (
          <span className="text-xs text-gray-600">
            {new Date(state.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {state.status === 'idle' && (
        <p className="text-xs text-gray-600">Waiting for leads to complete…</p>
      )}

      {state.status === 'running' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`h-0.5 flex-1 bg-gray-800 rounded`}>
              <div className={`h-0.5 rounded animate-pulse ${colors.dot}`} style={{ width: `${Math.min(100, (charCount / 4000) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500 tabular-nums">{charCount.toLocaleString()} chars</span>
          </div>
          <p className="text-xs text-gray-600">Generating artifact…</p>
        </div>
      )}

      {state.status === 'complete' && (
        <ArtifactSummary id={id} artifacts={artifacts} onView={() => onViewArtifact(id)} />
      )}

      {state.status === 'error' && (
        <p className="text-xs text-red-400">Generation failed</p>
      )}
    </div>
  );
}
