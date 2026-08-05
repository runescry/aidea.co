import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { openGmailMessage, resetGmailAccountCacheForTests } from './open-gmail';

describe('openGmailMessage', () => {
  const assign = vi.fn();
  const open = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    open.mockReset();
    fetchMock.mockReset();
    resetGmailAccountCacheForTests();
    vi.stubGlobal('window', { location: { assign }, open });
    vi.stubGlobal('location', { assign });
    vi.stubGlobal('open', open);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Android intent with authuser when account is on the link', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
    });

    await openGmailMessage({
      id: 'msg-1',
      from: 'School <office@school.edu>',
      subject: 'Permission slip',
      account: 'parent@gmail.com',
    });

    expect(assign).toHaveBeenCalledTimes(1);
    expect(String(assign.mock.calls[0]?.[0])).toContain('intent://');
    expect(String(assign.mock.calls[0]?.[0])).toContain('authuser=parent%40gmail.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves connected Gmail account when link omits account', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        connections: [{ integrationId: 'google-mail', email: 'parent@gmail.com' }],
      }),
    });

    await openGmailMessage({
      id: 'msg-1',
      from: 'School <office@school.edu>',
      subject: 'Permission slip',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/nango/connections?lite=1');
    expect(String(assign.mock.calls[0]?.[0])).toContain('authuser=parent%40gmail.com');
  });

  it('opens mobile Gmail web on iPhone', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile',
    });

    await openGmailMessage({
      id: 'msg-1',
      from: 'School <office@school.edu>',
      subject: 'Permission slip',
      account: 'parent@gmail.com',
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0]?.[0])).toContain('/mail/mu/mp/');
    expect(String(open.mock.calls[0]?.[0])).toContain('authuser=parent%40gmail.com');
  });
});
