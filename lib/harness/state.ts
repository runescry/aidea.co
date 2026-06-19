import type { EntityState, EntityType } from './types';
import { saveEntityState as persistState, loadEntityStates } from '@/lib/storage';

export function createEntityState(
  entityId: string,
  entityType: EntityType,
  entityName: string,
  initialData: Record<string, unknown>
): EntityState {
  return {
    entityId,
    entityType,
    entityName,
    status: 'running',
    data: initialData,
    decisions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function persistEntityState(state: EntityState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await persistState(state);
}

export async function findEntityState(entityId: string): Promise<EntityState | undefined> {
  const entities = await loadEntityStates();
  return entities.find(e => e.entityId === entityId);
}

export async function setStateKey(
  state: EntityState,
  key: string,
  value: unknown
): Promise<void> {
  state.data[key] = value;
  state.updatedAt = new Date().toISOString();
  await persistEntityState(state);
}

export function getStateKeys(
  state: EntityState,
  keys: string[]
): Record<string, unknown> {
  return Object.fromEntries(keys.map(k => [k, state.data[k] ?? null]));
}
