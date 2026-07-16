import { describe, expect, it } from 'vitest';
import type { KnowledgeBase } from '@/types/knowledge-base';
import {
  addContactToPerson,
  applyContactListToPeople,
  contactKey,
  findPersonByContact,
  findPersonByKey,
  isContactBlocked,
  listUnlinkedContactSignals,
  removePerson,
  restorePerson,
  upsertPerson,
} from './people';
import { ensurePeopleStore } from './people-migrate';

describe('profile people', () => {
  it('migrates legacy lists into people store', () => {
    const kb: KnowledgeBase = {
      relationships: { mentors: [{ name: 'Ada', email: 'ada@x.com' }] },
      work: { keyContacts: [{ name: 'Bob', email: 'bob@x.com' }] },
    };
    const migrated = ensurePeopleStore(kb);
    expect(migrated.relationships?.people).toHaveLength(2);
    expect(migrated.relationships?.people?.[0].status).toBe('active');
  });

  it('blocks removed contacts by key', () => {
    let kb: KnowledgeBase = {
      relationships: {
        people: [{
          id: 'p1',
          name: 'Sarah',
          email: 's@x.com',
          status: 'removed',
          removedAt: '2026-06-01T00:00:00.000Z',
        }],
        removedKeys: ['s@x.com'],
      },
    };
    expect(isContactBlocked(kb, { name: 'Sarah', email: 's@x.com' })).toBe(true);
    const restored = restorePerson(kb, 'p1');
    kb = restored.kb;
    expect(isContactBlocked(kb, { name: 'Sarah', email: 's@x.com' })).toBe(false);
  });

  it('removePerson adds removedKeys', () => {
    const kb: KnowledgeBase = {
      relationships: {
        people: [{ id: 'p1', name: 'Tom', email: 't@x.com', status: 'active' }],
      },
    };
    const { kb: next } = removePerson(kb, 'p1');
    expect(next.relationships?.removedKeys).toContain('t@x.com');
    expect(findPersonByKey(next, contactKey('Tom', 't@x.com'))?.status).toBe('removed');
  });

  it('upsertPerson merges by email key', () => {
    const kb: KnowledgeBase = { relationships: { people: [] } };
    const first = upsertPerson(kb, { name: 'Jane', email: 'j@x.com', relationship: 'mentor' });
    const second = upsertPerson(first.kb, { name: 'Jane Doe', email: 'j@x.com', company: 'Acme' });
    expect(second.kb.relationships?.people).toHaveLength(1);
    expect(second.person.company).toBe('Acme');
  });

  it('addContactToPerson attaches extra email and merges duplicate person', () => {
    let kb: KnowledgeBase = {
      relationships: {
        people: [
          { id: 'p1', name: 'Sarah Chen', email: 's@work.com', status: 'active' },
          { id: 'p2', name: 'Sarah Chen', email: 's@gmail.com', status: 'active' },
        ],
      },
    };
    const { kb: next, person } = addContactToPerson(kb, 'p1', { email: 's@gmail.com' });
    kb = next;
    expect(person?.emails).toEqual(expect.arrayContaining(['s@work.com', 's@gmail.com']));
    expect(kb.relationships?.people?.find(p => p.id === 'p2')?.status).toBe('removed');
    expect(findPersonByContact(kb, 's@gmail.com')?.id).toBe('p1');
  });

  it('listUnlinkedContactSignals finds graph emails not on a person', () => {
    const kb: KnowledgeBase = {
      relationships: {
        people: [{ id: 'p1', name: 'Ada', email: 'ada@x.com', status: 'active' }],
        interactionGraph: {
          entries: [
            { name: 'Bob', email: 'bob@x.com', channels: ['email'], interactions: [] },
            { name: 'Ada', email: 'ada@x.com', channels: ['email'], interactions: [] },
          ],
        },
      },
    };
    const unlinked = listUnlinkedContactSignals(kb);
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0].email).toBe('bob@x.com');
  });

  it('applyContactListToPeople upserts list into people store', () => {
    const kb: KnowledgeBase = { relationships: { people: [] } };
    const next = applyContactListToPeople(kb, [{ name: 'Ada', email: 'a@x.com' }], 'mentor');
    expect(next.relationships?.people).toHaveLength(1);
    expect(next.relationships?.people?.[0].relationship).toBe('mentor');
  });
});
