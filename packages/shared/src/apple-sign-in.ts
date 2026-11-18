// Sign in with Apple, the part that is not about either app.
//
// Apple has no static client secret. The "client secret" Better Auth sends to
// Apple's token endpoint is a short JWT (JSON Web Token) that we sign ourselves
// with the private key Apple issues (a .p8 file), naming our team, key and
// Services ID. Apple caps its life at six months. Signing it here, from the key,
// means nobody has to remember to mint a new one twice a year: the Worker signs
// one when it first needs it and keeps it until it is near expiry.
//
// Signing is WebCrypto (ECDSA P-256, SHA-256), which is what ES256 is. WebCrypto
// returns the raw r||s signature that JWS (JSON Web Signature) wants, so no DER
// conversion and no dependency.

/** The four values Apple's developer portal gives you. All four, or Apple stays off. */
export interface AppleConfig {
  /** The Services ID (not the App ID), e.g. `tools.bible.signin`. It is the OAuth client id. */
  clientId: string;
  /** The ten-character Team ID shown at the top right of the developer portal. */
  teamId: string;
  /** The Key ID of the Sign in with Apple key. */
  keyId: string;
  /** The contents of the `.p8` file, PEM (Privacy-Enhanced Mail) text. */
  privateKey: string;
}

/** The env names each app's Worker reads. Kept here so both apps and CI agree. */
export interface AppleEnv {
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
}

/**
 * Apple's authorization response comes back as a cross-site form POST from this
 * origin (`response_mode=form_post`), so Better Auth's origin check must trust it.
 */
export const APPLE_TRUSTED_ORIGIN = 'https://appleid.apple.com';

/** The longest life Apple accepts for a client secret, in seconds (about six months). */
export const APPLE_MAX_SECRET_SECONDS = 15_777_000;

/** How long a secret we sign lives. Well inside Apple's cap. */
export const APPLE_SECRET_SECONDS = 30 * 24 * 60 * 60;

/** A cached secret is replaced once it has less than this left. */
export const APPLE_SECRET_RENEW_SECONDS = 24 * 60 * 60;

/**
 * The Apple settings from a Worker's env, or null when any of the four is
 * missing or blank. Null means "show no Apple button and register no provider",
 * so the code can ship before the developer-portal setup is done.
 */
export function readAppleConfig(env: AppleEnv | undefined | null): AppleConfig | null {
  const clientId = env?.APPLE_CLIENT_ID?.trim();
  const teamId = env?.APPLE_TEAM_ID?.trim();
  const keyId = env?.APPLE_KEY_ID?.trim();
  const privateKey = env?.APPLE_PRIVATE_KEY?.trim();
  if (!clientId || !teamId || !keyId || !privateKey) return null;
  return { clientId, teamId, keyId, privateKey };
}

/**
 * The DER bytes inside a PEM private key. Accepts the key as pasted from the
 * .p8 file, and also with its line breaks written as literal `\n`, which is how
 * a multi-line value often survives a trip through a secrets form.
 */
export function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
    throw new Error('APPLE_PRIVATE_KEY is not a PEM private key');
  }
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign a client secret for Apple's token endpoint.
 *
 * @param nowSeconds Unix time in seconds; passed in so tests can pin it.
 * @param lifetimeSeconds How long it is good for, at most `APPLE_MAX_SECRET_SECONDS`.
 */
export async function createAppleClientSecret(
  config: AppleConfig,
  nowSeconds: number,
  lifetimeSeconds: number = APPLE_SECRET_SECONDS,
): Promise<string> {
  const life = Math.min(lifetimeSeconds, APPLE_MAX_SECRET_SECONDS);
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = {
    iss: config.teamId,
    iat: nowSeconds,
    exp: nowSeconds + life,
    aud: APPLE_TRUSTED_ORIGIN,
    sub: config.clientId,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(config.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

interface CachedSecret {
  fingerprint: string;
  secret: string;
  expiresAt: number;
}

let cached: CachedSecret | null = null;

function fingerprintOf(config: AppleConfig): string {
  return [config.clientId, config.teamId, config.keyId, config.privateKey].join('\u0000');
}

/**
 * A client secret for this config, signed once per Worker isolate and reused
 * until it has less than a day to live. A change to any of the four values
 * (a rotated key) signs a new one.
 */
export async function getAppleClientSecret(
  config: AppleConfig,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const fingerprint = fingerprintOf(config);
  if (
    cached &&
    cached.fingerprint === fingerprint &&
    cached.expiresAt - nowSeconds > APPLE_SECRET_RENEW_SECONDS
  ) {
    return cached.secret;
  }
  const secret = await createAppleClientSecret(config, nowSeconds);
  cached = { fingerprint, secret, expiresAt: nowSeconds + APPLE_SECRET_SECONDS };
  return secret;
}

/** For tests: forget the cached secret. */
export function resetAppleSecretCache(): void {
  cached = null;
}

/** What Better Auth's `socialProviders.apple` needs. */
export interface AppleProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * The credentials for Better Auth's Apple provider, or undefined when Apple is
 * not configured. Only the auth route needs this; the session check in the
 * middleware does not, so it never pays for the signing.
 *
 * A key that will not import or sign is logged and leaves Apple off rather than
 * throwing: a bad Apple secret must not take Google sign-in down with it.
 */
export async function resolveAppleCredentials(
  env: AppleEnv | undefined | null,
  nowSeconds?: number,
): Promise<AppleProviderCredentials | undefined> {
  const config = readAppleConfig(env);
  if (!config) return undefined;
  try {
    return {
      clientId: config.clientId,
      clientSecret: await getAppleClientSecret(config, nowSeconds),
    };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: the Worker's logs are where a bad key shows up
    console.error('Sign in with Apple is configured but its key could not be used:', error);
    return undefined;
  }
}
