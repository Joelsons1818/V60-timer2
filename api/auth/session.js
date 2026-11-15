import { errorResponse, json } from '../_lib/http.js';
import { isEmailAllowed } from '../_lib/googleIdentity.js';
import {
  clearSessionCookie,
  createSessionCookie,
  getSessionFromRequest,
  shouldRenewSession,
  toPublicUser,
} from '../_lib/session.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/auth/session') {
      return errorResponse('Not found.', 404);
    }

    if (request.method !== 'GET') {
      return errorResponse('Method not allowed.', 405);
    }

    try {
      const session = getSessionFromRequest(request);

      if (session && !isEmailAllowed(session.email)) {
        return json(
          { authenticated: false, user: null },
          { headers: { 'Set-Cookie': clearSessionCookie(request) } },
        );
      }

      return json(
        {
          authenticated: Boolean(session),
          user: toPublicUser(session),
        },
        session && shouldRenewSession(session)
          ? { headers: { 'Set-Cookie': createSessionCookie(session, request) } }
          : {},
      );
    } catch (error) {
      console.error('Session lookup failed', error);
      return errorResponse(error.message || 'Unable to load session.', 503);
    }
  },
};
