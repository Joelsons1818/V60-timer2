import { useEffect, useState } from 'react';
import { calculateRecipe } from '../utils/calculator';
import {
  loadBrewLogs,
  persistBrewLog,
  persistUpdatedBrewLog,
  removeBrewLog,
} from '../utils/storage';

const balanceLabels = {
  acidity: 'Acidity',
  balanced: 'Balanced',
  sweet: 'Sweet',
};

const DEFAULT_RATIO = 15;
const DEFAULT_GRIND_SIZE = 130;
const DEFAULT_STRENGTH_POURS = 3;
const MIN_RATIO = 10;
const MAX_RATIO = 20;

const formatDate = (isoDate) => {
  const date = new Date(isoDate);

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const createDraftId = () => {
  return globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}`;
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const roundToOneDecimal = (value) => {
  return Math.round(value * 10) / 10;
};

const normalizeCoffeeGrams = (coffeeGrams, totalWater, ratio) => {
  const parsedCoffee = parseNumber(coffeeGrams);

  if (parsedCoffee > 0) {
    return roundToOneDecimal(parsedCoffee);
  }

  const parsedWater = parseNumber(totalWater);
  const normalizedRatio = normalizeRatio(ratio);

  return parsedWater > 0 ? roundToOneDecimal(parsedWater / normalizedRatio) : 0;
};

const normalizeRatio = (value) => {
  const parsed = parseNumber(value, DEFAULT_RATIO);

  return Math.round(clamp(parsed, MIN_RATIO, MAX_RATIO) * 2) / 2;
};

const normalizeGrindSize = (value) => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  return clamp(Math.round(parseNumber(value, 0)), 0, 200);
};

const formatRatio = (ratio) => {
  const normalizedRatio = normalizeRatio(ratio);

  return Number.isInteger(normalizedRatio)
    ? String(normalizedRatio)
    : normalizedRatio.toFixed(1);
};

const buildLogFromFields = (fields) => {
  const normalizedWater = Math.max(1, Math.round(parseNumber(fields.totalWater, 300)));
  const normalizedTemperature = Math.max(1, Math.round(parseNumber(fields.temperature, 92)));
  const normalizedRatio = normalizeRatio(fields.ratio);
  const normalizedCoffee = normalizeCoffeeGrams(
    fields.coffeeGrams,
    normalizedWater,
    normalizedRatio,
  );
  const normalizedGrindSize = normalizeGrindSize(fields.grindSize);
  const normalizedBalance = ['acidity', 'balanced', 'sweet'].includes(fields.balance)
    ? fields.balance
    : 'balanced';
  const normalizedStrengthPours = Math.max(2, Math.min(5, Math.round(parseNumber(fields.strengthPoursCount, DEFAULT_STRENGTH_POURS))));
  const recipe = calculateRecipe(
    normalizedCoffee,
    normalizedWater,
    normalizedBalance,
    normalizedStrengthPours,
    normalizedRatio,
  );

  return {
    id: fields.id || createDraftId(),
    date: fields.date || new Date().toISOString(),
    coffeeName: fields.coffeeName?.trim() || '',
    notes: fields.notes?.trim() || '',
    coffeeGrams: recipe.coffeeGrams,
    totalWater: recipe.totalWater,
    temperature: normalizedTemperature,
    grindSize: normalizedGrindSize,
    balance: recipe.balance,
    strengthPoursCount: recipe.strengthPoursCount,
    totalTime: recipe.totalTime,
    ratio: recipe.ratio,
    steps: [],
  };
};

const createNewDraft = () => {
  return {
    ...buildLogFromFields({
      grindSize: DEFAULT_GRIND_SIZE,
      strengthPoursCount: DEFAULT_STRENGTH_POURS,
    }),
    isNew: true,
  };
};

const createDraft = (log) => {
  return {
    ...buildLogFromFields(log),
    isNew: false,
  };
};

export function HistoryScreen({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyLogId, setBusyLogId] = useState('');

  const refreshLogs = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      setLogs(await loadBrewLogs());
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load recipes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  const handleFieldChange = (field, value) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  };

  const handleRecipeFieldChange = (field, value) => {
    setDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const currentRatio = normalizeRatio(currentDraft.ratio);

      if (field === 'totalWater') {
        return {
          ...currentDraft,
          totalWater: value,
          coffeeGrams: roundToOneDecimal(parseNumber(value, 0) / currentRatio),
        };
      }

      if (field === 'coffeeGrams') {
        return {
          ...currentDraft,
          coffeeGrams: value,
          totalWater: Math.round(parseNumber(value, 0) * currentRatio),
        };
      }

      if (field === 'ratio') {
        const nextRatio = normalizeRatio(value);

        return {
          ...currentDraft,
          ratio: nextRatio,
          coffeeGrams: roundToOneDecimal(parseNumber(currentDraft.totalWater, 300) / nextRatio),
        };
      }

      return {
        ...currentDraft,
        [field]: value,
      };
    });
  };

  const handleCreateNew = () => {
    setDraft(createNewDraft());
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const handleEdit = (log) => {
    setDraft(createDraft(log));
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const handleSave = async () => {
    if (!draft) {
      return;
    }

    const normalizedLog = buildLogFromFields(draft);

    try {
      setErrorMessage('');

      if (draft.isNew) {
        await persistBrewLog(normalizedLog);
      } else {
        await persistUpdatedBrewLog(normalizedLog);
      }

      setDraft(null);
      await refreshLogs();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save recipe.');
    }
  };

  const handleDelete = async (log) => {
    const recipeName = log.coffeeName?.trim() || 'this recipe';
    const confirmed = window.confirm(`Delete ${recipeName}?`);

    if (!confirmed) {
      return;
    }

    try {
      setBusyLogId(log.id);
      setErrorMessage('');
      await removeBrewLog(log.id);

      if (draft?.id === log.id) {
        setDraft(null);
      }

      await refreshLogs();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete recipe.');
    } finally {
      setBusyLogId('');
    }
  };

  return (
    <div className="card history-card">
      <div className="screen-header">
        <div>
          <h2 className="section-title">Brew History</h2>
          <p className="screen-copy">
            Save and edit only the settings from the home screen.
          </p>
        </div>
        <div className="top-action-row top-action-row-tight">
          <button className="btn-ghost" onClick={handleCreateNew}>
            New Recipe
          </button>
          <button className="btn-ghost" onClick={onBack}>
            Home
          </button>
        </div>
      </div>

      {errorMessage && <p className="error-banner">{errorMessage}</p>}

      {draft && (
        <div className="history-editor-card">
          <div className="section-row">
            <h3 className="mini-title">
              {draft.isNew ? 'New Recipe' : 'Edit Recipe'}
            </h3>
            <span className="section-note">{formatDate(draft.date)}</span>
          </div>

          <div className="control-group">
            <label>Coffee Name</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={draft.coffeeName || ''}
                onChange={(event) => handleFieldChange('coffeeName', event.target.value)}
              />
            </div>
          </div>

          <div className="control-group">
            <label>Observation</label>
            <textarea
              className="text-area-field discreet-note-field"
              placeholder="Write a short note about the brew..."
              value={draft.notes || ''}
              onChange={(event) => handleFieldChange('notes', event.target.value)}
            />
          </div>

          <div className="primary-input-grid history-edit-grid">
            <div className="control-group compact-group">
              <label>Coffee</label>
              <div className="input-wrapper compact-input">
                <input
                  type="number"
                  inputMode="decimal"
                  enterKeyHint="done"
                  step="0.1"
                  value={draft.coffeeGrams}
                  onChange={(event) => handleRecipeFieldChange('coffeeGrams', event.target.value)}
                />
                <span className="unit compact-unit">g</span>
              </div>
            </div>

            <div className="control-group compact-group">
              <label>Water</label>
              <div className="input-wrapper compact-input">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  step="1"
                  value={draft.totalWater}
                  onChange={(event) => handleRecipeFieldChange('totalWater', event.target.value)}
                />
                <span className="unit compact-unit">ml</span>
              </div>
            </div>

            <div className="control-group compact-group">
              <label>Temp</label>
              <div className="input-wrapper compact-input">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  step="1"
                  value={draft.temperature}
                  onChange={(event) => handleFieldChange('temperature', event.target.value)}
                />
                <span className="unit compact-unit">°C</span>
              </div>
            </div>

            <div className="control-group compact-group">
              <label>Grind</label>
              <div className="input-wrapper compact-input">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  step="1"
                  min="0"
                  max="200"
                  value={draft.grindSize}
                  onChange={(event) => handleFieldChange('grindSize', event.target.value)}
                  placeholder="--"
                />
                <span className="unit compact-unit">0-200</span>
              </div>
            </div>
          </div>

          <div className="control-group ratio-control">
            <div className="slider-heading">
              <label>Ratio</label>
              <strong>1:{formatRatio(draft.ratio)}</strong>
            </div>
            <input
              className="range-control"
              type="range"
              min="10"
              max="20"
              step="0.5"
              value={normalizeRatio(draft.ratio)}
              onChange={(event) => handleRecipeFieldChange('ratio', event.target.value)}
              aria-label="Coffee to water ratio"
            />
            <div className="range-captions">
              <span>More concentrated</span>
              <span>More diluted</span>
            </div>
          </div>

          <div className="control-group">
            <label>Balance</label>
            <div className="toggle-group">
              {['acidity', 'balanced', 'sweet'].map((option) => (
                <button
                  key={option}
                  className={draft.balance === option ? 'active' : ''}
                  onClick={() => handleFieldChange('balance', option)}
                >
                  {balanceLabels[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>Stage 2 Pours</label>
            <div className="toggle-group">
              {[2, 3, 4, 5].map((pourCount) => (
                <button
                  key={pourCount}
                  className={draft.strengthPoursCount === pourCount ? 'active' : ''}
                  onClick={() => handleFieldChange('strengthPoursCount', pourCount)}
                >
                  {pourCount}
                </button>
              ))}
            </div>
          </div>

          <div className="button-row">
            <button className="btn-primary" onClick={handleSave}>
              {draft.isNew ? 'Save Recipe' : 'Save Changes'}
            </button>
            <button className="btn-secondary" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="empty-state">
          <h3>Loading recipes...</h3>
          <p>Checking your saved brews.</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <h3>No saved brews yet</h3>
          <p>Finish a recipe or create one manually.</p>
          <button className="btn-primary empty-state-action" onClick={handleCreateNew}>
            Create Recipe
          </button>
        </div>
      ) : (
        <div className="history-list compact-history-list modern-history-list">
          {logs.map((log) => (
            (() => {
              const coffeeGrams = normalizeCoffeeGrams(log.coffeeGrams, log.totalWater, log.ratio);

              return (
                <div key={log.id} className="history-entry-card history-entry-card-modern">
                  <div className="history-entry-top history-entry-top-modern">
                    <div className="history-entry-title-block history-entry-title-block-modern">
                      <strong>{log.coffeeName || 'Untitled Coffee'}</strong>
                      <div className="history-entry-meta">
                        <span className="section-note">{formatDate(log.date)}</span>
                      </div>
                    </div>

                    <div className="history-entry-actions history-entry-actions-modern">
                      <button className="btn-secondary btn-inline history-action-btn history-action-btn-modern" onClick={() => handleEdit(log)}>
                        Edit
                      </button>
                      <button
                        className="btn-secondary btn-inline history-action-btn history-action-btn-modern history-delete-btn"
                        onClick={() => handleDelete(log)}
                        disabled={busyLogId === log.id}
                      >
                        {busyLogId === log.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  <div className="history-method-strip">
                    <div className={`history-method-chip balance-${log.balance}`}>
                      <span className="detail-label">Flavor</span>
                      <strong>{balanceLabels[log.balance]}</strong>
                    </div>
                    <div className="history-method-chip">
                      <span className="detail-label">Stage 2</span>
                      <strong>{log.strengthPoursCount} pours</strong>
                    </div>
                    <div className="history-method-chip">
                      <span className="detail-label">Grind</span>
                      <strong>{log.grindSize === '' ? '--' : log.grindSize}</strong>
                    </div>
                  </div>

                  <div className="history-stats-stack">
                    <div className="history-stats-strip history-stats-strip-primary">
                      <div className="history-metric history-metric-modern">
                        <span className="detail-label">Coffee</span>
                        <strong>{coffeeGrams}g</strong>
                      </div>
                      <div className="history-metric history-metric-modern">
                        <span className="detail-label">Water</span>
                        <strong>{log.totalWater}ml</strong>
                      </div>
                      <div className="history-metric history-metric-modern">
                        <span className="detail-label">Temp</span>
                        <strong>{log.temperature}°C</strong>
                      </div>
                    </div>

                    <div className="history-stats-strip history-stats-strip-secondary">
                      <div className="history-metric history-metric-modern">
                        <span className="detail-label">Ratio</span>
                        <strong>1:{formatRatio(log.ratio)}</strong>
                      </div>
                      <div className="history-metric history-metric-modern">
                        <span className="detail-label">Time</span>
                        <strong>
                          ~{Math.floor(log.totalTime / 60)}:{String(log.totalTime % 60).padStart(2, '0')}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {log.notes && (
                    <div className="history-note-card history-note-card-modern">
                      <span className="detail-label">Observation</span>
                      <p className="history-note-copy">{log.notes}</p>
                    </div>
                  )}
                </div>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );
}
