import { clearSessionCookie } from '../_lib/session.js';
import { errorResponse, json, rejectIfCrossOrigin } from '../_lib/http.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/auth/logout') {
      return errorResponse('Not found.', 404);
    }

    if (request.method !== 'POST') {
      return errorResponse('Method not allowed.', 405);
    }

    const crossOriginError = rejectIfCrossOrigin(request);

    if (crossOriginError) {
      return errorResponse(crossOriginError, 403);
    }

    return json(
      {
        success: true,
      },
      {
        headers: {
          'Set-Cookie': clearSessionCookie(request),
        },
      },
    );
  },
};
