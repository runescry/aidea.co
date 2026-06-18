'use client';
import { useState } from 'react';
import type { ArtifactSet } from '@/types';

type Tab = 'copywriter' | 'outreach' | 'pricing' | 'research';

const TAB_LABELS: Record<Tab, string> = {
  copywriter: 'Copy',
  outreach: 'Outreach',
  pricing: 'Pricing',
  research: 'Research',
};

function CopyTab({ artifacts }: { artifacts: ArtifactSet }) {
  const a = artifacts.copywriter!;
  const lp = a.landingPageCopy;
  const [openEmail, setOpenEmail] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Landing Page */}
      <div>
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Landing Page</h3>
        <div className="bg-gray-950 rounded-lg p-4 space-y-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">Hero</p>
            <p className="text-xl font-bold text-white">{lp.heroHeadline}</p>
            <p className="text-sm text-gray-300 mt-1">{lp.heroSubheadline}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-indigo-600 text-white text-xs rounded">{lp.heroCTA}</span>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Problem</p>
            <p className="text-sm text-gray-300 whitespace-pre-line">{lp.problemSection}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Solution</p>
            <p className="text-sm text-gray-300 whitespace-pre-line">{lp.solutionSection}</p>
          </div>
          {lp.featuresSection.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-2">Features</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lp.featuresSection.map((f, i) => (
                  <div key={i} className="bg-gray-900 rounded p-3">
                    <p className="text-sm font-medium text-white">{f.icon} {f.headline}</p>
                    <p className="text-xs text-gray-400 mt-1">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-600 mb-1">Social Proof</p>
            <p className="text-sm text-gray-300 whitespace-pre-line">{lp.socialProofSection}</p>
          </div>
        </div>
      </div>

      {/* Emails */}
      <div>
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Email Sequence</h3>
        <div className="space-y-2">
          {a.emailSequence.map((email) => (
            <div key={email.emailNumber} className="bg-gray-950 rounded-lg border border-gray-800">
              <button
                onClick={() => setOpenEmail(openEmail === email.emailNumber ? null : email.emailNumber)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <span className="text-xs text-gray-500 mr-2">{email.sendTiming}</span>
                  <span className="text-sm text-white">{email.subject}</span>
                </div>
                <span className="text-gray-600 text-xs">{openEmail === email.emailNumber ? '▲' : '▼'}</span>
              </button>
              {openEmail === email.emailNumber && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                  <p className="text-xs text-gray-500 mb-2">Preview: {email.previewText}</p>
                  <p className="text-sm text-gray-300 whitespace-pre-line">{email.body}</p>
                  <p className="text-xs text-indigo-400 mt-3">{email.cta}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ads */}
      <div>
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Ad Variants</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {a.adVariants.map((ad, i) => (
            <div key={i} className="bg-gray-950 rounded-lg p-4 border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 uppercase">{ad.platform}</span>
                <span className="text-xs text-gray-600">→ {ad.targetAudience}</span>
              </div>
              <p className="text-sm font-bold text-white mb-1">{ad.headline}</p>
              <p className="text-xs text-pink-400 mb-2">{ad.hook}</p>
              <p className="text-xs text-gray-300">{ad.body}</p>
              <p className="text-xs text-indigo-400 mt-2 font-medium">{ad.cta}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OutreachTab({ artifacts }: { artifacts: ArtifactSet }) {
  const a = artifacts.outreach!;
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {a.messages.map((msg, i) => (
        <div key={i} className="bg-gray-950 rounded-lg border border-gray-800">
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
              msg.channel === 'email' ? 'text-cyan-400 bg-cyan-400/10' : 'text-blue-400 bg-blue-400/10'
            }`}>
              {msg.channel}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">{msg.personaType}</p>
              <p className="text-sm text-white truncate">
                {msg.subjectLine ?? msg.openingLine}
              </p>
            </div>
            <span className="text-xs text-gray-600 flex-shrink-0">{msg.tonality}</span>
            <span className="text-gray-600 text-xs flex-shrink-0">{openIdx === i ? '▲' : '▼'}</span>
          </button>
          {openIdx === i && (
            <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-2">
              {msg.subjectLine && (
                <p className="text-xs text-gray-500">Subject: <span className="text-gray-300">{msg.subjectLine}</span></p>
              )}
              <p className="text-xs text-cyan-400">{msg.openingLine}</p>
              <p className="text-sm text-gray-300 whitespace-pre-line">{msg.body}</p>
              <p className="text-xs text-indigo-400 font-medium">{msg.cta}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PricingTab({ artifacts }: { artifacts: ArtifactSet }) {
  const a = artifacts.pricing!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {a.tiers.map((tier, i) => (
          <div key={i} className={`rounded-lg p-3 border text-center ${
            tier.isHighlighted ? 'border-indigo-500 bg-indigo-950/30' : 'border-gray-800 bg-gray-950'
          }`}>
            {tier.isHighlighted && (
              <p className="text-xs text-indigo-400 mb-1">Most Popular</p>
            )}
            <p className="text-sm font-bold text-white">{tier.name}</p>
            <p className="text-lg font-bold text-white mt-1">{tier.price}</p>
            <p className="text-xs text-gray-500">{tier.billingPeriod}</p>
            <p className="text-xs text-gray-400 mt-1">{tier.tagline}</p>
            <ul className="text-left mt-2 space-y-1">
              {tier.features.slice(0, 5).map((f, j) => (
                <li key={j} className="text-xs text-gray-400">✓ {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Full pricing page preview:</p>
        <iframe
          srcDoc={a.htmlContent}
          className="w-full rounded-lg border border-gray-800"
          style={{ height: '600px' }}
          title="Pricing Page Preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

function ResearchTab({ artifacts }: { artifacts: ArtifactSet }) {
  const a = artifacts.research!;
  const [openQ, setOpenQ] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Discovery Questions</h3>
        <div className="space-y-2">
          {a.questions.map((q) => (
            <div key={q.id} className="bg-gray-950 rounded-lg border border-gray-800">
              <button
                onClick={() => setOpenQ(openQ === q.id ? null : q.id)}
                className="w-full flex items-start gap-3 p-4 text-left"
              >
                <span className="text-xs text-gray-600 flex-shrink-0 mt-0.5">Q{q.id}</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">{q.theme}</p>
                  <p className="text-sm text-white">{q.question}</p>
                </div>
                <span className="text-gray-600 text-xs flex-shrink-0">{openQ === q.id ? '▲' : '▼'}</span>
              </button>
              {openQ === q.id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Follow-ups</p>
                    <ul className="space-y-1">
                      {q.followUps.map((f, i) => (
                        <li key={i} className="text-xs text-gray-300">→ {f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Why ask this</p>
                    <p className="text-xs text-gray-400">{q.rationale}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Full Guide</h3>
        <pre className="text-xs text-gray-300 bg-gray-950 rounded-lg p-4 border border-gray-800 overflow-auto max-h-96 whitespace-pre-wrap font-mono">
          {a.guideMarkdown}
        </pre>
      </div>
    </div>
  );
}

interface ArtifactViewerProps {
  artifacts: ArtifactSet;
  defaultTab?: Tab;
}

export default function ArtifactViewer({ artifacts, defaultTab }: ArtifactViewerProps) {
  const availableTabs = (Object.keys(TAB_LABELS) as Tab[]).filter(t => !!artifacts[t]);
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab ?? availableTabs[0]);

  if (availableTabs.length === 0) return null;

  if (!availableTabs.includes(activeTab) && availableTabs.length > 0) {
    setActiveTab(availableTabs[0]);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-medium text-gray-200">Artifacts</h2>
        <div className="flex gap-1">
          {availableTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'copywriter' && artifacts.copywriter && <CopyTab artifacts={artifacts} />}
        {activeTab === 'outreach' && artifacts.outreach && <OutreachTab artifacts={artifacts} />}
        {activeTab === 'pricing' && artifacts.pricing && <PricingTab artifacts={artifacts} />}
        {activeTab === 'research' && artifacts.research && <ResearchTab artifacts={artifacts} />}
      </div>
    </div>
  );
}
