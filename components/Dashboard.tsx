'use client';
import { useState, useRef, useEffect } from 'react';
import { useAgentSession } from '@/hooks/useAgentSession';
import type { RunMode } from '@/types';
import CompanyIdentityCard from './CompanyIdentityCard';
import DirectiveCard from './DirectiveCard';
import LeadCard from './LeadCard';
import ConflictAlert from './ConflictAlert';
import WorkingGroupCard from './WorkingGroupCard';
import ArtifactViewer from './ArtifactViewer';
import StreamLog from './StreamLog';

const LEAD_IDS = ['cpo', 'cmo', 'cto', 'cfo'] as const;
const LEAD_LABELS: Record<string, string> = {
  cpo: 'CPO — Product',
  cmo: 'CMO — Marketing',
  cto: 'CTO — Engineering',
  cfo: 'CFO — Finance',
};
const WG_IDS = ['copywriter', 'outreach', 'pricing', 'research'] as const;
const WG_LABELS: Record<string, string> = {
  copywriter: 'Copywriter',
  outreach: 'Outreach',
  pricing: 'Pricing',
  research: 'Research',
};

export default function Dashboard() {
  const { state, startSession, resumeSession, reset, setIdea, setMode } = useAgentSession();
  const {
    isRunning, isPaused, companyIdentity, directive, leadOutputs,
    conflictReport, artifacts, cycle2Directive, agents, streamLog, error, sessionId, idea, mode,
  } = state;

  const [artifactTab, setArtifactTab] = useState<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasStarted = isRunning || isPaused || !!companyIdentity;

  // Show leads section once directive is issued or any lead has started
  const showLeads = !!directive || LEAD_IDS.some(id => agents[id].status !== 'idle');
  // Show working groups once any has started
  const showWorkingGroups = WG_IDS.some(id => agents[id].status !== 'idle');
  // Show artifacts section once any artifact exists
  const hasArtifacts = !!(artifacts.copywriter || artifacts.outreach || artifacts.pricing || artifacts.research);

  const handleStart = () => {
    const val = textareaRef.current?.value?.trim() ?? '';
    if (!val) return;
    startSession(val, mode);
  };

  const handleViewArtifact = (tab: string) => {
    setArtifactTab(tab as 'copywriter' | 'outreach' | 'pricing' | 'research');
    setTimeout(() => {
      document.getElementById('artifacts')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Agentic Co</h1>
            <p className="text-xs text-gray-600">Multi-agent startup simulation</p>
          </div>
          {hasStarted && (
            <button
              onClick={() => { reset(); setArtifactTab(undefined); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              New Session
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Idea Input ─────────────────────────────────────────────────────── */}
        {!hasStarted && (
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Mode:</span>
              {(['full_auto', 'pause_after_working_groups'] as RunMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${
                    mode === m
                      ? 'border-indigo-500 text-indigo-300 bg-indigo-950/40'
                      : 'border-gray-700 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {m === 'full_auto' ? 'Full Auto' : 'Pause After Working Groups'}
                </button>
              ))}
            </div>

            {/* Idea input */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                What startup should we build?
              </label>
              <textarea
                ref={textareaRef}
                rows={4}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="e.g. A tool that helps indie hackers understand which features drive retention vs churn, built on top of their existing analytics data"
                onChange={e => setIdea(e.target.value)}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-600">
                  CEO + 4 leads + 4 working groups → real artifacts in one cycle
                </p>
                <button
                  onClick={handleStart}
                  disabled={isRunning}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Launch Company →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
            <p className="text-xs text-red-400 font-medium mb-1">Error</p>
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => reset()}
              className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
            >
              Reset and try again
            </button>
          </div>
        )}

        {/* ── Running indicator ────────────────────────────────────────────── */}
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-dot" />
            <span className="text-xs text-gray-500">Company is running…</span>
          </div>
        )}

        {/* ── Company Identity ──────────────────────────────────────────────── */}
        {companyIdentity && <CompanyIdentityCard identity={companyIdentity} />}

        {/* ── CEO Directive ─────────────────────────────────────────────────── */}
        {directive && (
          <DirectiveCard directive={directive} cycleLabel="Cycle 1 Directive" />
        )}

        {/* ── Leads 2×2 ────────────────────────────────────────────────────── */}
        {showLeads && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LEAD_IDS.map(id => (
              <LeadCard
                key={id}
                id={id}
                state={agents[id]}
                output={leadOutputs[id as keyof typeof leadOutputs]}
                label={LEAD_LABELS[id]}
              />
            ))}
          </div>
        )}

        {/* ── Conflict ─────────────────────────────────────────────────────── */}
        {conflictReport && <ConflictAlert report={conflictReport} />}

        {/* ── Working Groups 2×2 ───────────────────────────────────────────── */}
        {showWorkingGroups && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WG_IDS.map(id => (
              <WorkingGroupCard
                key={id}
                id={id}
                state={agents[id]}
                artifacts={artifacts}
                label={WG_LABELS[id]}
                onViewArtifact={handleViewArtifact}
              />
            ))}
          </div>
        )}

        {/* ── Pause / Resume ───────────────────────────────────────────────── */}
        {isPaused && sessionId && (
          <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-xl p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-yellow-300">Session Paused</p>
              <p className="text-xs text-yellow-600 mt-1">
                Review the artifacts above. Resume to get the CEO Cycle 2 directive.
              </p>
            </div>
            <button
              onClick={() => resumeSession(sessionId, idea)}
              className="flex-shrink-0 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Resume →
            </button>
          </div>
        )}

        {/* ── CEO Cycle 2 Directive ────────────────────────────────────────── */}
        {cycle2Directive && (
          <DirectiveCard directive={cycle2Directive} cycleLabel="Cycle 2 Directive" />
        )}

        {/* ── Artifacts ────────────────────────────────────────────────────── */}
        {hasArtifacts && (
          <div id="artifacts">
            <ArtifactViewer
              artifacts={artifacts}
              defaultTab={artifactTab as 'copywriter' | 'outreach' | 'pricing' | 'research' | undefined}
            />
          </div>
        )}

        {/* ── Activity Log ─────────────────────────────────────────────────── */}
        {streamLog.length > 0 && <StreamLog events={streamLog} />}

      </main>
    </div>
  );
}
