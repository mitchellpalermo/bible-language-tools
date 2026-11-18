// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  APPLE_MAX_SECRET_SECONDS,
  APPLE_SECRET_RENEW_SECONDS,
  APPLE_SECRET_SECONDS,
  APPLE_TRUSTED_ORIGIN,
  type AppleConfig,
  createAppleClientSecret,
  getAppleClientSecret,
  pemToPkcs8,
  readAppleConfig,
  resetAppleSecretCache,
  resolveAppleCredentials,
} from './apple-sign-in';

const NOW = 1_800_000_000;

let publicKey: CryptoKey;
let pem: string;
let config: AppleConfig;

function toPem(der: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(der)) binary += String.fromCharCode(byte);
  const lines = btoa(binary).match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

function fromBase64url(part: string): Uint8Array<ArrayBuffer> {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(fromBase64url(part)));
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  publicKey = pair.publicKey;
  pem = toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  config = {
    clientId: 'tools.bible.signin',
    teamId: 'TEAM123456',
    keyId: 'KEY1234567',
    privateKey: pem,
  };
});

afterEach(() => {
  resetAppleSecretCache();
  vi.restoreAllMocks();
});

describe('readAppleConfig', () => {
  const full = {
    APPLE_CLIENT_ID: ' tools.bible.signin ',
    APPLE_TEAM_ID: 'TEAM123456',
    APPLE_KEY_ID: 'KEY1234567',
    APPLE_PRIVATE_KEY: 'pem',
  };

  it('returns the four values, trimmed, when all are set', () => {
    expect(readAppleConfig(full)).toEqual({
      clientId: 'tools.bible.signin',
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      privateKey: 'pem',
    });
  });

  it.each([
    'APPLE_CLIENT_ID',
    'APPLE_TEAM_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
  ] as const)('is null when %s is missing or blank', (name) => {
    expect(readAppleConfig({ ...full, [name]: undefined })).toBeNull();
    expect(readAppleConfig({ ...full, [name]: '   ' })).toBeNull();
  });

  it('is null with no env at all', () => {
    expect(readAppleConfig(undefined)).toBeNull();
    expect(readAppleConfig(null)).toBeNull();
  });
});

describe('pemToPkcs8', () => {
  it('reads a key with escaped line breaks the same as the real ones', () => {
    expect(pemToPkcs8(pem.replace(/\n/g, '\\n'))).toEqual(pemToPkcs8(pem));
  });

  it('refuses text that is not a key', () => {
    expect(() => pemToPkcs8('not a key!')).toThrow(/not a PEM private key/);
    expect(() => pemToPkcs8('-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----')).toThrow();
  });
});

describe('createAppleClientSecret', () => {
  it('signs a JWT Apple accepts: ES256, kid, and the five claims', async () => {
    const jwt = await createAppleClientSecret(config, NOW);
    const [header, payload, signature] = jwt.split('.');

    expect(decodePart(header)).toEqual({ alg: 'ES256', kid: 'KEY1234567', typ: 'JWT' });
    expect(decodePart(payload)).toEqual({
      iss: 'TEAM123456',
      iat: NOW,
      exp: NOW + APPLE_SECRET_SECONDS,
      aud: APPLE_TRUSTED_ORIGIN,
      sub: 'tools.bible.signin',
    });

    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      fromBase64url(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);
  });

  it('never outlives the six months Apple allows', async () => {
    const jwt = await createAppleClientSecret(config, NOW, 10 * APPLE_MAX_SECRET_SECONDS);
    expect(decodePart(jwt.split('.')[1]).exp).toBe(NOW + APPLE_MAX_SECRET_SECONDS);
  });
});

describe('getAppleClientSecret', () => {
  it('reuses one secret while it has more than a day left', async () => {
    const first = await getAppleClientSecret(config, NOW);
    const later = NOW + APPLE_SECRET_SECONDS - APPLE_SECRET_RENEW_SECONDS - 1;
    expect(await getAppleClientSecret(config, later)).toBe(first);
  });

  it('signs a new one once less than a day is left', async () => {
    const first = await getAppleClientSecret(config, NOW);
    const later = NOW + APPLE_SECRET_SECONDS - APPLE_SECRET_RENEW_SECONDS;
    const renewed = await getAppleClientSecret(config, later);
    expect(renewed).not.toBe(first);
    expect(decodePart(renewed.split('.')[1]).iat).toBe(later);
  });

  it('signs a new one when the key id changes', async () => {
    const first = await getAppleClientSecret(config, NOW);
    const rotated = await getAppleClientSecret({ ...config, keyId: 'KEY7654321' }, NOW);
    expect(rotated).not.toBe(first);
    expect(decodePart(rotated.split('.')[0]).kid).toBe('KEY7654321');
  });

  it('uses the current time when none is given', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW * 1000);
    const jwt = await getAppleClientSecret(config);
    expect(decodePart(jwt.split('.')[1]).iat).toBe(NOW);
  });
});

describe('resolveAppleCredentials', () => {
  const env = () => ({
    APPLE_CLIENT_ID: config.clientId,
    APPLE_TEAM_ID: config.teamId,
    APPLE_KEY_ID: config.keyId,
    APPLE_PRIVATE_KEY: config.privateKey,
  });

  it('is undefined when Apple is not configured', async () => {
    expect(await resolveAppleCredentials({})).toBeUndefined();
  });

  it('gives the Services ID and a signed secret', async () => {
    const creds = await resolveAppleCredentials(env(), NOW);
    expect(creds?.clientId).toBe('tools.bible.signin');
    expect(decodePart(creds?.clientSecret.split('.')[1] ?? '').sub).toBe('tools.bible.signin');
  });

  it('leaves Apple off, and does not throw, when the key is unusable', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const creds = await resolveAppleCredentials({ ...env(), APPLE_PRIVATE_KEY: 'garbage!' }, NOW);
    expect(creds).toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });

  it('leaves Apple off when the key is base64 but not an EC key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const creds = await resolveAppleCredentials({ ...env(), APPLE_PRIVATE_KEY: 'AAAA' }, NOW);
    expect(creds).toBeUndefined();
  });
});
