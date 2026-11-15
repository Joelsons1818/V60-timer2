import { checkSheetsAccess } from './_lib/googleSheets.js';
import { errorResponse, json } from './_lib/http.js';
import { getSessionFromRequest } from './_lib/session.js';

const hasEnv = (...names) => {
  return names.some((name) => Boolean(process.env[name]));
};

// Quick self-test: open /api/health in the browser to see which part of the
// setup is broken. It only reports yes/no, never any secret value.
export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return errorResponse('Method not allowed.', 405);
    }

    const checks = {
      googleLoginConfigured: hasEnv('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_IDS', 'VITE_GOOGLE_CLIENT_ID'),
      allowedEmailConfigured: hasEnv('ALLOWED_GOOGLE_EMAIL', 'ALLOWED_GOOGLE_EMAILS'),
      sessionSecretConfigured: hasEnv('SESSION_SECRET'),
      sheetsConfigured:
        hasEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL')
        && hasEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
        && hasEnv('GOOGLE_SHEETS_SPREADSHEET_ID'),
      sheetsReachable: false,
    };
    let sheetsError = '';

    if (checks.sheetsConfigured) {
      try {
        await checkSheetsAccess();
        checks.sheetsReachable = true;
      } catch (error) {
        sheetsError = error.message || 'Unknown Google Sheets error.';
      }
    }

    const ok = Object.values(checks).every(Boolean);
    const body = { ok, checks };

    // The detailed Google error is only shown to the signed-in owner.
    if (sheetsError) {
      body.sheetsError = checks.sessionSecretConfigured && getSessionFromRequest(request)
        ? sheetsError
        : 'Sign in to the app to see the detailed error.';
    }

    return json(body, { status: ok ? 200 : 503 });
  },
};
