import { useEffect, useRef, useState } from 'react';
import { hasGoogleClientId, renderGoogleButton } from '../utils/auth';

export function GoogleSignInButton({ onError, onSuccess }) {
  const containerRef = useRef(null);
  const [buttonError, setButtonError] = useState(
    hasGoogleClientId() ? '' : 'Google login is not configured yet.',
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    if (!hasGoogleClientId()) {
      return undefined;
    }

    renderGoogleButton(container, {
      onSuccess: (user) => {
        if (cancelled) {
          return;
        }

        setButtonError('');
        onSuccess?.(user);
      },
      onError: (error) => {
        if (cancelled) {
          return;
        }

        const message = error.message || 'Unable to sign in with Google.';
        setButtonError(message);
        onError?.(error);
      },
    }).catch((error) => {
      if (cancelled) {
        return;
      }

      setButtonError(error.message || 'Unable to load Google login.');
    });

    return () => {
      cancelled = true;

      container.innerHTML = '';
    };
  }, [onError, onSuccess]);

  return (
    <div className="google-auth-shell">
      <div ref={containerRef} className="google-auth-button" />
      {buttonError && <p className="auth-helper-text">{buttonError}</p>}
    </div>
  );
}
