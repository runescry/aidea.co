/** Agent statuses that mean the run will not produce more output. */
export function isTerminalAgentStatus(status: string | undefined): boolean {
  return status === 'complete' || status === 'error';
}

export function classifyAgentWait(
  roles: string[],
  statusForRole: (role: string) => string | undefined,
): { allTerminal: boolean; failed: string[]; pending: string[] } {
  const failed: string[] = [];
  const pending: string[] = [];

  for (const role of roles) {
    const status = statusForRole(role);
    if (status === 'error') failed.push(role);
    else if (status !== 'complete') pending.push(role);
  }

  return {
    allTerminal: roles.length > 0 && pending.length === 0 && roles.every(r => isTerminalAgentStatus(statusForRole(r))),
    failed,
    pending,
  };
}
