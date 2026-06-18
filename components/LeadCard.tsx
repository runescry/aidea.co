'use client';
import type { AgentId, AgentState, CPOOutput, CMOOutput, CTOOutput, CFOOutput } from '@/types';

type LeadOutput = CPOOutput | CMOOutput | CTOOutput | CFOOutput;

interface Props {
  id: AgentId;
  state: AgentState;
  output: LeadOutput | undefined;
  label: string;
}

const COLORS: Record<string, { border: string; badge: string; dot: string }> = {
  cpo: { border: 'border-blue-900/50', badge: 'text-blue-400 bg-blue-400/10', dot: 'bg-blue-400' },
  cmo: { border: 'border-purple-900/50', badge: 'text-purple-400 bg-purple-400/10', dot: 'bg-purple-400' },
  cto: { border: 'border-emerald-900/50', badge: 'text-emerald-400 bg-emerald-400/10', dot: 'bg-emerald-400' },
  cfo: { border: 'border-orange-900/50', badge: 'text-orange-400 bg-orange-400/10', dot: 'bg-orange-400' },
};

function StatusDot({ status, color }: { status: AgentState['status']; color: string }) {
  if (status === 'idle') return <span className="w-2 h-2 rounded-full bg-gray-700 flex-shrink-0" />;
  if (status === 'running') return <span className={`w-2 h-2 rounded-full ${color} animate-pulse-dot flex-shrink-0`} />;
  if (status === 'complete') return <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />;
}

function CPODetails({ output }: { output: CPOOutput }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-300">{output.productVision}</p>
      <div>
        <p className="text-xs text-gray-500 mb-1">MVP Features ({output.mvpFeatures.length})</p>
        <ul className="space-y-1">
          {output.mvpFeatures.slice(0, 4).map((f, i) => (
            <li key={i} className="text-xs text-gray-400 flex gap-2">
              <span className="text-gray-600">·</span>
              <span><span className="text-gray-300">{f.name}</span> — {f.effort}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CMODetails({ output }: { output: CMOOutput }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-300">{output.marketingStrategy.slice(0, 200)}{output.marketingStrategy.length > 200 ? '…' : ''}</p>
      <div className="flex gap-4">
        <div>
          <p className="text-xs text-gray-500">Launch</p>
          <p className="text-sm font-medium text-purple-300">{output.launchTimelineWeeks}wks</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Budget</p>
          <p className="text-sm font-medium text-purple-300">{output.estimatedBudget}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {output.channels.slice(0, 3).map((c, i) => (
          <span key={i} className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{c.name}</span>
        ))}
      </div>
    </div>
  );
}

function CTODetails({ output }: { output: CTOOutput }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-300">{output.architectureOverview.slice(0, 200)}{output.architectureOverview.length > 200 ? '…' : ''}</p>
      <div className="flex gap-4">
        <div>
          <p className="text-xs text-gray-500">Effort</p>
          <p className="text-sm font-medium text-emerald-300">{output.effortEstimateWeeks}wks</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Sprints</p>
          <p className="text-sm font-medium text-emerald-300">{output.sprintPlan.length}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {output.techStack.slice(0, 4).map((t, i) => (
          <span key={i} className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{t.choice}</span>
        ))}
      </div>
    </div>
  );
}

function CFODetails({ output }: { output: CFOOutput }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-300">{output.revenueModel}</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'LTV/CAC', value: output.unitEconomics.ltvCacRatio },
          { label: 'Runway', value: `${output.runwayMonths}mo` },
          { label: 'Y1 Revenue', value: output.year1Projection.revenue },
          { label: 'Payback', value: output.unitEconomics.paybackPeriod },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xs font-medium text-orange-300">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function isCPO(o: LeadOutput, id: AgentId): o is CPOOutput { return id === 'cpo'; }
function isCMO(o: LeadOutput, id: AgentId): o is CMOOutput { return id === 'cmo'; }
function isCTO(o: LeadOutput, id: AgentId): o is CTOOutput { return id === 'cto'; }
function isCFO(o: LeadOutput, id: AgentId): o is CFOOutput { return id === 'cfo'; }

export default function LeadCard({ id, state, output, label }: Props) {
  const colors = COLORS[id] ?? COLORS.cpo;

  return (
    <div className={`bg-gray-900 border ${colors.border} rounded-xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={state.status} color={colors.dot} />
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

      {state.status === 'running' && state.streamBuffer && (
        <pre className="text-xs text-gray-500 font-mono bg-gray-950 rounded p-2 overflow-hidden max-h-24 leading-relaxed">
          {state.streamBuffer.slice(-500)}
        </pre>
      )}

      {state.status === 'idle' && (
        <p className="text-xs text-gray-600">Waiting for directive…</p>
      )}

      {state.status === 'complete' && output && (
        <>
          {isCPO(output, id) && <CPODetails output={output} />}
          {isCMO(output, id) && <CMODetails output={output} />}
          {isCTO(output, id) && <CTODetails output={output} />}
          {isCFO(output, id) && <CFODetails output={output} />}
        </>
      )}
    </div>
  );
}
