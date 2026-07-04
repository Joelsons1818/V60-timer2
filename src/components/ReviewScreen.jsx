import { useState } from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';

const balanceLabels = {
  acidity: 'Acidity',
  balanced: 'Balanced',
  sweet: 'Sweet',
};

const formatRatio = (ratio) => {
  return Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1);
};

export function ReviewScreen({
  authError = '',
  isLocalMode = false,
  onBackHome,
  onSave,
  onSignedIn,
  recipe,
  storageError = '',
  user,
}) {
  const canSave = isLocalMode || Boolean(user);
  const [coffeeName, setCoffeeName] = useState('');
  const [notes, setNotes] = useState('');
  const displayedRatio = formatRatio(recipe.ratio);
  const displayedGrind = recipe.grindSize === '' ? '--' : recipe.grindSize;

  const handleSave = () => {
    onSave({
      coffeeName,
      notes,
    });
  };

  return (
    <div className="card">
      <div className="screen-header">
        <div>
          <h2 className="section-title">Save This Brew</h2>
          <p className="screen-copy">
            Save the exact setup you just used.
          </p>
        </div>
        <button className="btn-ghost" onClick={onBackHome}>
          Home
        </button>
      </div>

      <div className="history-entry-card review-entry-card">
        <div className="history-entry-top">
          <strong>Current Recipe</strong>
        </div>

        <div className="history-compact-grid">
          <div className="history-metric">
            <span className="detail-label">Coffee</span>
            <strong>{recipe.coffeeGrams}g</strong>
          </div>
          <div className="history-metric">
            <span className="detail-label">Water</span>
            <strong>{recipe.totalWater}ml</strong>
          </div>
          <div className="history-metric">
            <span className="detail-label">Temp</span>
            <strong>{recipe.temperature}°C</strong>
          </div>
          <div className="history-metric">
            <span className="detail-label">Ratio</span>
            <strong>1:{displayedRatio}</strong>
          </div>
          <div className="history-metric">
            <span className="detail-label">Grind</span>
            <strong>{displayedGrind}</strong>
          </div>
          <div className="history-metric">
            <span className="detail-label">Balance</span>
            <strong>{balanceLabels[recipe.balance]}</strong>
          </div>
          <div className="history-metric">
            <span className="detail-label">Stage 2</span>
            <strong>{recipe.strengthPoursCount} pours</strong>
          </div>
        </div>
      </div>

      <div className="control-group">
        <label>Coffee Name</label>
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="ex: Ethiopia Natural"
            value={coffeeName}
            onChange={(event) => setCoffeeName(event.target.value)}
          />
        </div>
      </div>

      <div className="control-group">
        <label>Observation</label>
        <textarea
          className="text-area-field discreet-note-field"
          placeholder="ex: moagem mais fina, florou bem, ficou mais doce..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {!canSave && (
        <div className="auth-panel">
          <h3 className="mini-title">Sign In To Save</h3>
          <p className="screen-copy">
            Use your Google account to save this recipe to your private history.
          </p>
          <GoogleSignInButton onSuccess={onSignedIn} />
        </div>
      )}

      <div className="action-buttons">
        <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
          Save To History
        </button>
        <button className="btn-secondary" onClick={onBackHome}>
          Back Home
        </button>
      </div>

      {storageError && <p className="error-banner">{storageError}</p>}
      {authError && <p className="error-banner">{authError}</p>}
    </div>
  );
}
