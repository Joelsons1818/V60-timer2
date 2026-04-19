import { verifyGoogleCredential } from '../_lib/googleIdentity.js';
import { errorResponse, json, readJsonBody, rejectIfCrossOrigin } from '../_lib/http.js';
import { createSessionCookie, toPublicUser } from '../_lib/session.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/auth/google') {
      return errorResponse('Not found.', 404);
    }

    if (request.method !== 'POST') {
      return errorResponse('Method not allowed.', 405);
    }

    const crossOriginError = rejectIfCrossOrigin(request);

    if (crossOriginError) {
      return errorResponse(crossOriginError, 403);
    }

    const payload = await readJsonBody(request);
    const credential = payload?.credential;

    if (!credential) {
      return errorResponse('Google credential is required.', 400);
    }

    try {
      const user = await verifyGoogleCredential(credential);

      return json(
        {
          user: toPublicUser(user),
        },
        {
          headers: {
            'Set-Cookie': createSessionCookie(user, request),
          },
        },
      );
    } catch (error) {
      console.error('Google auth failed', error);
      return errorResponse(error.message || 'Unable to sign in with Google.', 401);
    }
  },
};
