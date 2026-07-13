import { describe, expect, it } from 'vitest';
import { InMemoryCallRepository } from './InMemoryCallRepository.js';
import type { Call } from '../domain/Call.js';

const baseCall = (): Call => ({
  id: 'call-1',
  sessionId: 'session-1',
  fonemaCallId: 'fonema-1',
  agentId: 'agent',
  phoneNumber: '+573001234567',
  variables: {},
  status: 'queued',
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

describe('InMemoryCallRepository', () => {
  it('guarda y consulta por id, session y fonema', async () => {
    const repo = new InMemoryCallRepository();
    const call = baseCall();
    await repo.save(call);
    expect(await repo.findById('call-1')).toEqual(call);
    expect(await repo.findBySessionId('session-1')).toEqual(call);
    expect(await repo.findByFonemaCallId('fonema-1')).toEqual(call);
  });

  it('ordena findAll y findLatestByPhoneNumber por fecha', async () => {
    const repo = new InMemoryCallRepository();
    await repo.save({ ...baseCall(), id: 'old', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
    await repo.save(baseCall());
    expect((await repo.findAll())[0].id).toBe('call-1');
    expect((await repo.findLatestByPhoneNumber('+573001234567'))?.id).toBe('call-1');
  });
});
