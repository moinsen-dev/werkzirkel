import { describe, it, expect } from 'vitest';
import { auth } from '@/lib/auth';

describe('Better-Auth-Konfiguration', () => {
  it('exportiert eine auth-Instance', () => {
    expect(auth).toBeTruthy();
    expect(typeof auth).toBe('object');
  });

  it('stellt auth.handler als Funktion bereit', () => {
    expect(typeof auth.handler).toBe('function');
  });

  it('verwendet wz_session als Session-Cookie-Name', () => {
    // Better-Auth materialisiert die konfigurierten Cookies unter `auth.$context`.
    // Wir greifen defensiv zu, da der Form-Type je nach Plugin-Set variiert.
    const ctx = (auth as unknown as { $context: Promise<unknown> }).$context;
    return Promise.resolve(ctx).then((resolved) => {
      const cookies = (resolved as { authCookies?: { sessionToken?: { name?: string } } }).authCookies;
      expect(cookies?.sessionToken?.name).toBe('wz_session');
    });
  });
});
