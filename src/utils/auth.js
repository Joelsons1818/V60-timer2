const AUTH_SESSION_ENDPOINT = '/api/auth/session';
const AUTH_GOOGLE_ENDPOINT = '/api/auth/google';
const AUTH_LOGOUT_ENDPOINT = '/api/auth/logout';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const isDevelopment = import.meta.env.DEV;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let googleScriptPromise;

const parseResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage);
  }

  return payload;
};

const loadGoogleScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In is only available in the browser.'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Google Sign-In.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Unable to load Google Sign-In.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

export const hasGoogleClientId = () => {
  return Boolean(googleClientId);
};

export const loadSession = async () => {
  try {
    const payload = await parseResponse(
      await fetch(AUTH_SESSION_ENDPOINT, {
        credentials: 'include',
      }),
      'Unable to load Google session.',
    );

    return {
      mode: 'remote',
      user: payload.user || null,
    };
  } catch (error) {
    if (isDevelopment) {
      return {
        mode: 'local',
        user: null,
      };
    }

    throw error;
  }
};

export const exchangeGoogleCredential = async (credential) => {
  const payload = await parseResponse(
    await fetch(AUTH_GOOGLE_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    }),
    'Unable to sign in with Google.',
  );

  return payload.user || null;
};

export const logoutSession = async () => {
  await parseResponse(
    await fetch(AUTH_LOGOUT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
    }),
    'Unable to sign out.',
  );
};

export const disableGoogleAutoSelect = () => {
  window.google?.accounts?.id?.disableAutoSelect?.();
};

export const renderGoogleButton = async (
  container,
  {
    onError,
    onSuccess,
    text = 'signin_with',
  } = {},
) => {
  if (!container) {
    throw new Error('Google button container is missing.');
  }

  if (!googleClientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured.');
  }

  const google = await loadGoogleScript();

  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: async ({ credential }) => {
      if (!credential) {
        onError?.(new Error('Google did not return a credential.'));
        return;
      }

      try {
        const user = await exchangeGoogleCredential(credential);
        onSuccess?.(user);
      } catch (error) {
        onError?.(error);
      }
    },
  });

  container.innerHTML = '';

  google.accounts.id.renderButton(container, {
    text,
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    logo_alignment: 'left',
    width: Math.max(container.clientWidth || 280, 240),
  });
};
