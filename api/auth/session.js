import { errorResponse, json } from '../_lib/http.js';
import { getSessionFromRequest, toPublicUser } from '../_lib/session.js';

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

      return json({
        authenticated: Boolean(session),
        user: toPublicUser(session),
      });
    } catch (error) {
      console.error('Session lookup failed', error);
      return errorResponse(error.message || 'Unable to load session.', 503);
    }
  },
};
