'use client';

const INTENSITY_COLOR: Record<string, string> = {
  rest: 'text-foreground-subtle',
  light: 'text-success',
  moderate: 'text-warning',
  hard: 'text-danger',
};

export interface HealthBriefData {
  todayWorkout?: string;
  estimatedDurationMins?: number;
  intensity?: string;
  mealSuggestions?: string[];
  hydrationGoalLitres?: number;
  quickNote?: string;
}

export default function HealthBriefRenderer({ data }: { data: HealthBriefData }) {
  if (!data.todayWorkout) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50">
          <div className="text-xs text-foreground-subtle mb-1">Workout</div>
          <div className="text-sm text-foreground font-medium">{data.todayWorkout}</div>
          <div className="flex items-center gap-2 mt-1">
            {typeof data.estimatedDurationMins === 'number' && data.estimatedDurationMins > 0 && (
              <span className="text-xs text-foreground-subtle">{data.estimatedDurationMins} min</span>
            )}
            {data.intensity && (
              <span className={`text-xs ${INTENSITY_COLOR[data.intensity] ?? 'text-foreground-muted'}`}>
                {data.intensity}
              </span>
            )}
          </div>
        </div>
        {typeof data.hydrationGoalLitres === 'number' && (
          <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50">
            <div className="text-xs text-foreground-subtle mb-1">Hydration</div>
            <div className="text-sm text-foreground font-medium">{data.hydrationGoalLitres}L</div>
            {data.quickNote && (
              <div className="text-xs text-foreground-muted mt-1">{data.quickNote}</div>
            )}
          </div>
        )}
      </div>
      {data.mealSuggestions && data.mealSuggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">Meals</p>
          {data.mealSuggestions.map((meal, i) => (
            <div key={i} className="text-xs text-foreground-muted">• {meal}</div>
          ))}
        </div>
      )}
    </div>
  );
}
