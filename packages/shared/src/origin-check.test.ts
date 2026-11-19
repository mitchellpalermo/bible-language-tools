// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CROSS_SITE_POST_PATHS, crossSiteRefusal } from './origin-check';

const SITE = 'https://hebrew.tools';

function req(
  path: string,
  {
    method = 'POST',
    origin,
    contentType,
  }: { method?: string; origin?: string; contentType?: string } = {},
) {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  if (contentType) headers.set('content-type', contentType);
  return new Request(`${SITE}${path}`, { method, headers });
}

describe('crossSiteRefusal', () => {
  it("lets Apple's form POST through to its callback", () => {
    const request = req('/api/auth/callback/apple', {
      origin: 'https://appleid.apple.com',
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(crossSiteRefusal(request)).toBeNull();
  });

  it('exempts exact paths only', () => {
    for (const path of [
      '/api/auth/callback/apple/',
      '/api/auth/callback/applex',
      '/api/auth/callback/google',
    ]) {
      const request = req(path, {
        origin: 'https://appleid.apple.com',
        contentType: 'application/x-www-form-urlencoded',
      });
      expect(crossSiteRefusal(request)?.status, path).toBe(403);
    }
  });

  it('exempts only the Apple callback', () => {
    expect(CROSS_SITE_POST_PATHS).toEqual(['/api/auth/callback/apple']);
  });

  it.each([
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=x',
    'text/plain;charset=UTF-8',
    'Application/X-WWW-Form-Urlencoded',
  ])('refuses a cross-site %s POST anywhere else', async (contentType) => {
    const response = crossSiteRefusal(
      req('/api/progress', { origin: 'https://evil.example', contentType }),
    );
    expect(response?.status).toBe(403);
    expect(await response?.text()).toBe('Cross-site POST form submissions are forbidden');
  });

  it('refuses a cross-site request with no content type, naming its method', async () => {
    const response = crossSiteRefusal(
      req('/api/progress', { method: 'DELETE', origin: 'https://evil.example' }),
    );
    expect(response?.status).toBe(403);
    expect(await response?.text()).toBe('Cross-site DELETE form submissions are forbidden');
  });

  it('refuses a form POST with no origin header', () => {
    const request = req('/api/auth/signout', { contentType: 'application/x-www-form-urlencoded' });
    expect(crossSiteRefusal(request)?.status).toBe(403);
  });

  it('lets a same-origin form POST through', () => {
    const request = req('/api/auth/signout', {
      origin: SITE,
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(crossSiteRefusal(request)).toBeNull();
  });

  it('lets a JSON body through from any origin, as Astro does', () => {
    const request = req('/api/progress', {
      method: 'PUT',
      origin: 'https://evil.example',
      contentType: 'application/json',
    });
    expect(crossSiteRefusal(request)).toBeNull();
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('never refuses %s', (method) => {
    expect(
      crossSiteRefusal(req('/api/progress', { method, origin: 'https://evil.example' })),
    ).toBeNull();
  });
});
