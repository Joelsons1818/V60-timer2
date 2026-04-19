import { GoogleSignInButton } from './GoogleSignInButton';

export function AuthScreen({
  authError = '',
  onBack,
  onSignedIn,
}) {
  return (
    <div className="card">
      <div className="screen-header">
        <div>
          <h2 className="section-title">Private History</h2>
          <p className="screen-copy">
            Sign in with your authorized Google account to open and edit the recipe history saved in your private Drive sheet.
          </p>
        </div>
        <button className="btn-ghost" onClick={onBack}>
          Home
        </button>
      </div>

      <div className="auth-panel">
        <h3 className="mini-title">Google Login Required</h3>
        <p className="screen-copy">
          Only the e-mail configured by you on Vercel will be accepted here.
        </p>
        <GoogleSignInButton onSuccess={onSignedIn} />
      </div>

      {authError && <p className="error-banner">{authError}</p>}
    </div>
  );
}
