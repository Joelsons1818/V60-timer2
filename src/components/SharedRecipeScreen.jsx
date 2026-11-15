import { balanceLabels, formatRatio } from '../utils/brewLog';

export function SharedRecipeScreen({ onDismiss, onSave, onUse, recipe }) {
  return (
    <div className="card">
      <div className="screen-header">
        <div>
          <h2 className="section-title">Shared Recipe</h2>
          <p className="screen-copy">
            Someone shared this brew with you.
          </p>
        </div>
        <button className="btn-ghost" onClick={onDismiss}>
          Home
        </button>
      </div>

      <div className="history-entry-card review-entry-card">
        <div className="history-entry-top">
          <strong>{recipe.coffeeName || 'Untitled Coffee'}</strong>
        </div>

        <div className="review-metric-stack">
          <div className="review-metric-row review-metric-row-three">
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
          </div>

          <div className="review-metric-row review-metric-row-two">
            <div className="history-metric">
              <span className="detail-label">Ratio</span>
              <strong>1:{formatRatio(recipe.ratio)}</strong>
            </div>
            <div className="history-metric">
              <span className="detail-label">Grind</span>
              <strong>{recipe.grindSize === '' ? '--' : recipe.grindSize}</strong>
            </div>
          </div>

          <div className="review-metric-row review-metric-row-two">
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

        {recipe.notes && (
          <div className="history-note-card history-note-card-modern">
            <span className="detail-label">Observation</span>
            <p className="history-note-copy">{recipe.notes}</p>
          </div>
        )}
      </div>

      <div className="action-buttons">
        <button className="btn-primary" onClick={onUse}>
          Use This Recipe
        </button>
        <button className="btn-secondary" onClick={onSave}>
          Save To My History
        </button>
      </div>
    </div>
  );
}
