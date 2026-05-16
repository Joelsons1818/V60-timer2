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

const buildLogFromFields = (fields) => {
  const normalizedCoffee = Math.round(parseNumber(fields.coffeeGrams, 20) * 10) / 10;
  const normalizedWater = Math.max(1, Math.round(parseNumber(fields.totalWater, 300)));
  const normalizedTemperature = Math.max(1, Math.round(parseNumber(fields.temperature, 92)));
  const normalizedBalance = ['acidity', 'balanced', 'sweet'].includes(fields.balance)
    ? fields.balance
    : 'balanced';
  const normalizedStrengthPours = Math.max(2, Math.min(5, Math.round(parseNumber(fields.strengthPoursCount, 2))));
  const recipe = calculateRecipe(
    normalizedCoffee,
    normalizedWater,
    normalizedBalance,
    normalizedStrengthPours,
  );

  return {
    id: fields.id || createDraftId(),
    date: fields.date || new Date().toISOString(),
    coffeeName: fields.coffeeName?.trim() || '',
    notes: fields.notes?.trim() || '',
    coffeeGrams: recipe.coffeeGrams,
    totalWater: recipe.totalWater,
    temperature: normalizedTemperature,
    balance: recipe.balance,
    strengthPoursCount: recipe.strengthPoursCount,
    totalTime: recipe.totalTime,
    ratio: recipe.ratio,
    steps: [],
  };
};

const createNewDraft = () => {
  return {
    ...buildLogFromFields({}),
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
                  step="0.1"
                  value={draft.coffeeGrams}
                  onChange={(event) => handleFieldChange('coffeeGrams', event.target.value)}
                />
                <span className="unit compact-unit">g</span>
              </div>
            </div>

            <div className="control-group compact-group">
              <label>Water</label>
              <div className="input-wrapper compact-input">
                <input
                  type="number"
                  step="1"
                  value={draft.totalWater}
                  onChange={(event) => handleFieldChange('totalWater', event.target.value)}
                />
                <span className="unit compact-unit">ml</span>
              </div>
            </div>

            <div className="control-group compact-group">
              <label>Temp</label>
              <div className="input-wrapper compact-input">
                <input
                  type="number"
                  step="1"
                  value={draft.temperature}
                  onChange={(event) => handleFieldChange('temperature', event.target.value)}
                />
                <span className="unit compact-unit">°C</span>
              </div>
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
            <div key={log.id} className="history-entry-card history-entry-card-modern">
              <div className="history-entry-top history-entry-top-modern">
                <div className="history-entry-title-block history-entry-title-block-modern">
                  <strong>{log.coffeeName || 'Untitled Coffee'}</strong>
                  <div className="history-entry-meta">
                    <span className="section-note">{formatDate(log.date)}</span>
                    <span className="history-meta-divider" aria-hidden="true">•</span>
                    <span className="history-balance-text">{balanceLabels[log.balance]}</span>
                    <span className="history-meta-divider" aria-hidden="true">•</span>
                    <span className="history-stage-text">{log.strengthPoursCount} pours</span>
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

              <div className="history-stats-strip">
                <div className="history-metric history-metric-modern">
                  <span className="detail-label">Coffee</span>
                  <strong>{log.coffeeGrams}g</strong>
                </div>
                <div className="history-metric history-metric-modern">
                  <span className="detail-label">Water</span>
                  <strong>{log.totalWater}ml</strong>
                </div>
                <div className="history-metric history-metric-modern">
                  <span className="detail-label">Temp</span>
                  <strong>{log.temperature}°C</strong>
                </div>
                <div className="history-metric history-metric-modern">
                  <span className="detail-label">Ratio</span>
                  <strong>1:{log.ratio}</strong>
                </div>
                <div className="history-metric history-metric-modern">
                  <span className="detail-label">Time</span>
                  <strong>
                    ~{Math.floor(log.totalTime / 60)}:{String(log.totalTime % 60).padStart(2, '0')}
                  </strong>
                </div>
              </div>

              {log.notes && (
                <div className="history-note-card history-note-card-modern">
                  <span className="detail-label">Observation</span>
                  <p className="history-note-copy">{log.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
