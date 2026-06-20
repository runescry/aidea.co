export interface PendingHumanInput {
  requestId: string;
  question: string;
  context?: string;
  agentRole: string;
}

export function pendingInputFromEvent(
  data: Record<string, unknown>,
  agentRole?: string,
): PendingHumanInput {
  return {
    requestId: data.requestId as string,
    question: (data.prompt ?? data.question) as string,
    context: typeof data.context === 'string' ? data.context : undefined,
    agentRole: agentRole ?? 'agent',
  };
}
