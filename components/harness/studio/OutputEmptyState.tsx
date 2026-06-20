const OUTPUT_SECTIONS = [
  { title: 'Morning brief', lines: ['Top priorities', 'Calendar highlights', 'Inbox triage'] },
  { title: 'Drafts & actions', lines: ['Email replies', 'Queued approvals', 'Follow-ups'] },
  { title: 'Research & artifacts', lines: ['Structured notes', 'Deliverables', 'Consensus decisions'] },
];

export default function OutputEmptyState() {
  return (
    <div className="max-w-lg mx-auto px-4 space-y-4">
      <div className="text-center space-y-1">
        <p className="text-title text-foreground">Output-first workspace</p>
        <p className="text-caption text-foreground-muted">
          Run a workflow above. Deliverables land here first — agents, tools, and state are secondary tabs.
        </p>
      </div>
      <div className="grid gap-2">
        {OUTPUT_SECTIONS.map(section => (
          <div key={section.title} className="card p-3 space-y-2">
            <div className="text-caption font-medium text-foreground">{section.title}</div>
            <ul className="space-y-1">
              {section.lines.map(line => (
                <li key={line} className="flex items-center gap-2 text-micro text-foreground-subtle">
                  <span className="w-8 h-2 rounded bg-surface-subtle shrink-0" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
