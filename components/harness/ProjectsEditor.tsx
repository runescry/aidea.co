'use client';

import type { CurrentProjects } from '@/types/knowledge-base';
import { Label } from './forms';

interface Props {
  value?: CurrentProjects;
  onChange: (v: CurrentProjects) => void;
}

export default function ProjectsEditor({ value, onChange }: Props) {
  if (!value || Array.isArray(value)) {
    const lines = Array.isArray(value) ? value.join('\n') : '';
    return (
      <textarea
        rows={4}
        className="input-field resize-none font-mono text-xs"
        placeholder="One project per line — or paste structured JSON"
        value={lines}
        onChange={e => onChange(e.target.value.split('\n').filter(Boolean))}
      />
    );
  }

  const structured = value;

  const updateJob = (index: number, field: string, val: string) => {
    const jobs = [...(structured.jobApplications ?? [])];
    jobs[index] = { ...jobs[index], [field]: field === 'priority' ? Number(val) || undefined : val };
    onChange({ ...structured, jobApplications: jobs });
  };

  const updateBuild = (index: number, field: string, val: string) => {
    const builds = [...(structured.personalBuilds ?? [])];
    builds[index] = { ...builds[index], [field]: val };
    onChange({ ...structured, personalBuilds: builds });
  };

  return (
    <div className="space-y-4">
      {(structured.jobApplications ?? []).length > 0 && (
        <div>
          <Label>Job applications</Label>
          <div className="space-y-2">
            {(structured.jobApplications ?? []).map((job, i) => (
              <div key={i} className="card p-3 space-y-2 text-xs">
                <div className="font-medium text-foreground">
                  {job.company} — {job.role}
                  {job.priority != null && <span className="text-foreground-subtle ml-2">P{job.priority}</span>}
                </div>
                <input className="input-field-sm" value={job.status ?? ''} placeholder="Status"
                  onChange={e => updateJob(i, 'status', e.target.value)} />
                <input className="input-field-sm" value={job.nextAction ?? ''} placeholder="Next action"
                  onChange={e => updateJob(i, 'nextAction', e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}
      {(structured.personalBuilds ?? []).length > 0 && (
        <div>
          <Label>Personal builds</Label>
          <div className="space-y-2">
            {(structured.personalBuilds ?? []).map((build, i) => (
              <div key={i} className="card p-3 space-y-2 text-xs">
                <div className="font-medium text-foreground">{build.name}</div>
                <div className="text-foreground-muted">{build.description}</div>
                <div className="text-foreground-subtle">{build.status}</div>
                <input className="input-field-sm" value={build.nextAction ?? ''} placeholder="Next action"
                  onChange={e => updateBuild(i, 'nextAction', e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function formatProjectSummary(projects?: CurrentProjects): string {
  if (!projects) return '0 listed';
  if (Array.isArray(projects)) return `${projects.length} listed`;
  const jobs = projects.jobApplications?.length ?? 0;
  const builds = projects.personalBuilds?.length ?? 0;
  return `${jobs} applications, ${builds} builds`;
}
