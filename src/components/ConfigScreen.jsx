import React from 'react';

export function ConfigScreen({
  authError,
  authMode,
  coffeeGrams,
  setCoffeeGrams,
  waterAmount,
  setWaterAmount,
  temperature,
  setTemperature,
  balance,
  setBalance,
  strengthPours,
  setStrengthPours,
  recipe,
  onStart,
  onHistory,
  onOpenAuth,
  onLogout,
  user,
}) {
  const isCheckingAuth = authMode === 'loading';

  return (
    <div className="card">
      <div className="top-action-row top-action-row-wrap">
        <button className="btn-ghost" onClick={onHistory}>
          History
        </button>

        <div className="top-action-row top-action-row-tight">
          {user && (
            <span className="status-pill status-pill-email" title={user.email}>
              {user.email}
            </span>
          )}

          {!user && !isCheckingAuth && (
            <button className="btn-ghost" onClick={onOpenAuth}>
              Google Login
            </button>
          )}

          {user && (
            <button className="btn-ghost" onClick={onLogout}>
              Logout
            </button>
          )}
        </div>
      </div>

      {authError && <p className="error-banner">{authError}</p>}

      <header className="header">
        <h1>4:6 Method</h1>
        <p className="subtitle">Tetsu Kasuya V60 Guide</p>
      </header>

      <div className="primary-input-grid">
        <div className="control-group compact-group">
          <label>Coffee</label>
          <div className="input-wrapper compact-input">
            <input
              type="number"
              value={coffeeGrams}
              onChange={(event) => setCoffeeGrams(Number(event.target.value))}
              step="0.1"
              min="10"
              max="100"
            />
            <span className="unit compact-unit">g</span>
          </div>
        </div>

        <div className="control-group compact-group">
          <label>Water</label>
          <div className="input-wrapper compact-input">
            <input
              type="number"
              value={waterAmount}
              onChange={(event) => setWaterAmount(Number(event.target.value))}
              step="1"
              min="150"
              max="1500"
            />
            <span className="unit compact-unit">ml</span>
          </div>
        </div>

        <div className="control-group compact-group">
          <label>Temp</label>
          <div className="input-wrapper compact-input">
            <input
              type="number"
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
              step="1"
              min="75"
              max="100"
            />
            <span className="unit compact-unit">°C</span>
          </div>
        </div>
      </div>

      <div className="control-group">
        <label>Balance (Flavor)</label>
        <div className="toggle-group">
          <button
            className={balance === 'acidity' ? 'active' : ''}
            onClick={() => setBalance('acidity')}
          >
            Acidity
          </button>
          <button
            className={balance === 'balanced' ? 'active' : ''}
            onClick={() => setBalance('balanced')}
          >
            Balanced
          </button>
          <button
            className={balance === 'sweet' ? 'active' : ''}
            onClick={() => setBalance('sweet')}
          >
            Sweet
          </button>
        </div>
        <p className="helper-text">
          {balance === 'acidity' && 'More Acidity (Large 1st Pour)'}
          {balance === 'balanced' && 'Balanced Cup (Equal Pours)'}
          {balance === 'sweet' && 'More Sweetness (Small 1st Pour)'}
        </p>
      </div>

      <div className="control-group">
        <label>Strength (Number of Pours)</label>
        <div className="toggle-group">
          {[2, 3, 4, 5].map((pourCount) => (
            <button
              key={pourCount}
              className={strengthPours === pourCount ? 'active' : ''}
              onClick={() => setStrengthPours(pourCount)}
            >
              {pourCount}
            </button>
          ))}
        </div>
        <p className="helper-text">
          {strengthPours} pours for strength phase ({Math.round(120 / strengthPours)}s each).
          {strengthPours >= 4 ? ' Higher Extraction (Stronger)' : ' Lower Extraction (Milder)'}
        </p>
      </div>

      <div className="recipe-summary compact-summary">
        <div className="summary-item">
          <span className="label">Total Water</span>
          <span className="value">{recipe.totalWater}ml</span>
        </div>
        <div className="summary-item">
          <span className="label">Temp</span>
          <span className="value">{temperature}°C</span>
        </div>
        <div className="summary-item">
          <span className="label">Ratio</span>
          <span className="value">1:15</span>
        </div>
        <div className="summary-item">
          <span className="label">Time</span>
          <span className="value">
            ~{Math.floor(recipe.totalTime / 60)}:{(recipe.totalTime % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      <button className="btn-primary" onClick={onStart}>
        Start Brewing
      </button>
      <div className="made-by-card">Made by Daniel Joelsons</div>
    </div>
  );
}
