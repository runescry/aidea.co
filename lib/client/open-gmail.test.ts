import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { openGmailMessage, resetGmailAccountCacheForTests } from './open-gmail';

describe('openGmailMessage', () => {
  const open = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    open.mockReset();
    fetchMock.mockReset();
    resetGmailAccountCacheForTests();
    vi.stubGlobal('window', { open });
    vi.stubGlobal('open', open);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens account-specific Gmail URL in browser on Android', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
    });

    const popup = { closed: false, location: { replace: vi.fn() } } as unknown as Window;
    await openGmailMessage({
      id: 'msg-1',
      from: 'School <office@school.edu>',
      subject: 'Permission slip',
      account: 'parent@gmail.com',
    }, popup);

    expect(popup.location.replace).toHaveBeenCalledTimes(1);
    const url = String((popup.location.replace as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(url).toContain('/mail/u/parent%40gmail.com/');
    expect(url).toContain('#search/');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves connected Gmail account when link omits account', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
    });
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ connections: [] }) })
      .mockResolvedValueOnce({
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(open.mock.calls[0]?.[0])).toContain('/mail/u/parent%40gmail.com/');
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
    expect(String(open.mock.calls[0]?.[0])).toContain('/mail/u/parent%40gmail.com/');
    expect(String(open.mock.calls[0]?.[0])).toContain('#search/');
  });
});
