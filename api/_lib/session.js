import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE_NAME = 'v60_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const encodeBase64Url = (value) => {
  return Buffer.from(value, 'utf8').toString('base64url');
};

const decodeBase64Url = (value) => {
  return Buffer.from(value, 'base64url').toString('utf8');
};

const parseCookies = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = part.slice(0, separatorIndex);
      const value = decodeURIComponent(part.slice(separatorIndex + 1));

      cookies[key] = value;
      return cookies;
    }, {});
};

const getSessionSecret = () => {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error('SESSION_SECRET is not configured.');
  }

  return secret;
};

const signValue = (value) => {
  return createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('base64url');
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const buildSessionPayload = (user) => {
  const now = Math.floor(Date.now() / 1000);

  return {
    sub: user.sub,
    email: user.email,
    name: user.name || '',
    picture: user.picture || '',
    iat: now,
    exp: now + SESSION_MAX_AGE,
  };
};

const serializeCookie = (value, request, maxAge) => {
  const isSecure =
    new URL(request.url).protocol === 'https:' || Boolean(process.env.VERCEL_ENV);

  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

export const toPublicUser = (session) => {
  if (!session) {
    return null;
  }

  return {
    email: session.email,
    name: session.name || '',
    picture: session.picture || '',
  };
};

export const createSessionCookie = (user, request) => {
  const payload = encodeBase64Url(JSON.stringify(buildSessionPayload(user)));
  const signature = signValue(payload);

  return serializeCookie(`${payload}.${signature}`, request, SESSION_MAX_AGE);
};

export const clearSessionCookie = (request) => {
  return serializeCookie('', request, 0);
};

export const getSessionFromRequest = (request) => {
  try {
    const cookies = parseCookies(request.headers.get('cookie') || '');
    const sessionToken = cookies[SESSION_COOKIE_NAME];

    if (!sessionToken) {
      return null;
    }

    const [payload, signature] = sessionToken.split('.');

    if (!payload || !signature) {
      return null;
    }

    const expectedSignature = signValue(payload);

    if (!safeEqual(signature, expectedSignature)) {
      return null;
    }

    const session = JSON.parse(decodeBase64Url(payload));
    const now = Math.floor(Date.now() / 1000);

    if (!session?.email || !session?.sub || !session?.exp || session.exp <= now) {
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to read session cookie', error);
    return null;
  }
};
