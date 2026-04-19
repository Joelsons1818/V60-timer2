import { createPublicKey, verify } from 'node:crypto';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set([
  'accounts.google.com',
  'https://accounts.google.com',
]);

let certificateCache = {
  expiresAt: 0,
  keys: new Map(),
};

const splitEnvList = (...values) => {
  return values
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
};

const decodeJwtSegment = (segment) => {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
};

const getConfiguredClientIds = () => {
  const clientIds = splitEnvList(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_IDS,
    process.env.VITE_GOOGLE_CLIENT_ID,
  );

  if (clientIds.length === 0) {
    throw new Error('GOOGLE_CLIENT_ID is not configured.');
  }

  return new Set(clientIds);
};

const getAllowedEmails = () => {
  const emails = splitEnvList(
    process.env.ALLOWED_GOOGLE_EMAIL,
    process.env.ALLOWED_GOOGLE_EMAILS,
  ).map((value) => value.toLowerCase());

  if (emails.length === 0) {
    throw new Error('ALLOWED_GOOGLE_EMAIL is not configured.');
  }

  return new Set(emails);
};

const getCacheExpiry = (response) => {
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  return Date.now() + (maxAge * 1000);
};

const fetchGoogleKeys = async (forceRefresh = false) => {
  if (!forceRefresh && certificateCache.expiresAt > Date.now() && certificateCache.keys.size > 0) {
    return certificateCache.keys;
  }

  const response = await fetch(GOOGLE_CERTS_URL, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to fetch Google signing keys.');
  }

  const payload = await response.json();
  const keys = new Map(
    (payload.keys || []).map((key) => [key.kid, key]),
  );

  certificateCache = {
    expiresAt: getCacheExpiry(response),
    keys,
  };

  return keys;
};

const verifySignature = (token, jwk) => {
  const segments = token.split('.');
  const signedContent = `${segments[0]}.${segments[1]}`;
  const signature = Buffer.from(segments[2], 'base64url');
  const publicKey = createPublicKey({
    key: jwk,
    format: 'jwk',
  });

  return verify(
    'RSA-SHA256',
    Buffer.from(signedContent),
    publicKey,
    signature,
  );
};

export const verifyGoogleCredential = async (credential) => {
  if (!credential || typeof credential !== 'string') {
    throw new Error('Google credential is required.');
  }

  const segments = credential.split('.');

  if (segments.length !== 3) {
    throw new Error('Google credential is malformed.');
  }

  const header = decodeJwtSegment(segments[0]);
  const payload = decodeJwtSegment(segments[1]);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Google credential format.');
  }

  let keys = await fetchGoogleKeys();
  let jwk = keys.get(header.kid);

  if (!jwk) {
    keys = await fetchGoogleKeys(true);
    jwk = keys.get(header.kid);
  }

  if (!jwk || !verifySignature(credential, jwk)) {
    throw new Error('Google credential signature is invalid.');
  }

  const allowedClientIds = getConfiguredClientIds();
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = Math.floor(Date.now() / 1000);

  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new Error('Google credential issuer is invalid.');
  }

  if (!audiences.some((audience) => allowedClientIds.has(audience))) {
    throw new Error('Google credential was issued for a different app.');
  }

  if (!payload.exp || payload.exp <= now) {
    throw new Error('Google credential has expired.');
  }

  if (payload.nbf && payload.nbf > now + 60) {
    throw new Error('Google credential is not valid yet.');
  }

  const isEmailVerified =
    payload.email_verified === true || payload.email_verified === 'true';

  if (!payload.sub || !payload.email || !isEmailVerified) {
    throw new Error('Google account email is not verified.');
  }

  const allowedEmails = getAllowedEmails();

  if (!allowedEmails.has(String(payload.email).toLowerCase())) {
    throw new Error('This Google account is not authorized for this app.');
  }

  return {
    sub: String(payload.sub),
    email: String(payload.email),
    name: payload.name ? String(payload.name) : '',
    picture: payload.picture ? String(payload.picture) : '',
  };
};
