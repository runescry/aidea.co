export function getNestedKey(obj: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((curr, part) => {
    if (curr && typeof curr === 'object') return (curr as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

export function setNestedKey(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof curr[parts[i]] !== 'object' || curr[parts[i]] === null) {
      curr[parts[i]] = {};
    }
    curr = curr[parts[i]] as Record<string, unknown>;
  }
  curr[parts[parts.length - 1]] = value;
}
