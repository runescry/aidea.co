import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { openGmailMessage } from './open-gmail';

describe('openGmailMessage', () => {
  const assign = vi.fn();
  const open = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    open.mockReset();
    vi.stubGlobal('window', { location: { assign }, open });
    vi.stubGlobal('location', { assign });
    vi.stubGlobal('open', open);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Android intent on Pixel-class user agents', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
    });

    openGmailMessage({
      id: 'msg-1',
      from: 'School <office@school.edu>',
      subject: 'Permission slip',
      account: 'parent@gmail.com',
    });

    expect(assign).toHaveBeenCalledTimes(1);
    expect(String(assign.mock.calls[0]?.[0])).toContain('intent://');
    expect(String(assign.mock.calls[0]?.[0])).toContain('com.google.android.gm');
    expect(open).not.toHaveBeenCalled();
  });

  it('opens mobile Gmail web on iPhone', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile',
    });

    openGmailMessage({
      id: 'msg-1',
      from: 'School <office@school.edu>',
      subject: 'Permission slip',
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0]?.[0])).toContain('/mail/mu/mp/');
    expect(String(open.mock.calls[0]?.[0])).toContain('#tl/search/');
  });
});
