import { normalizeRating, normalizeTastingTags } from './tasting';

// Local-first storage.
// Every brew is written to this device first and only then sent to the
// private Google Sheet. If the server, the login or the network fails, the
// brew stays here marked as "pending" and is sent again automatically later,
// so nothing is ever lost.

const STORAGE_KEY = 'v60_brew_logs';
const PENDING_DELETES_KEY = 'v60_pending_deletes';
const API_ENDPOINT = '/api/recipes';
const REQUEST_TIMEOUT = 15000;

const readJson = (key) => {
  try {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to read ${key}`, error);
    return [];
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write ${key}`, error);
  }
};

const sortNewestFirst = (logs) => {
  return logs.slice().sort((left, right) => {
    return (new Date(right.date).getTime() || 0) - (new Date(left.date).getTime() || 0);
  });
};

const readLogs = () => readJson(STORAGE_KEY).filter((log) => log && log.id);
const writeLogs = (logs) => writeJson(STORAGE_KEY, logs);
const readPendingDeletes = () => readJson(PENDING_DELETES_KEY).map(String);
const writePendingDeletes = (ids) => writeJson(PENDING_DELETES_KEY, ids);

const roundToOneDecimal = (value) => {
  return Math.round(value * 10) / 10;
};

const normalizeCoffeeGrams = (recipe) => {
  const coffeeGrams = Number(recipe.coffeeGrams);

  if (Number.isFinite(coffeeGrams) && coffeeGrams > 0) {
    return roundToOneDecimal(coffeeGrams);
  }

  const totalWater = Number(recipe.totalWater);
  const ratio = Number(recipe.ratio) || 15;

  return totalWater > 0 ? roundToOneDecimal(totalWater / ratio) : 0;
};

const toRemoteRecipe = (log) => {
  const recipe = { ...log, steps: [] };

  delete recipe.pending;
  return recipe;
};

const upsertLocal = (log, pending) => {
  const entry = { ...toRemoteRecipe(log), pending };
  const logs = readLogs().filter((current) => current.id !== entry.id);

  logs.push(entry);
  writeLogs(logs);
  return entry;
};

export function getBrewLogs() {
  return sortNewestFirst(readLogs());
}

export function getPendingCount() {
  return readLogs().filter((log) => log.pending).length + readPendingDeletes().length;
}

export function buildBrewLog(recipe, details = {}) {
  const generatedId = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: generatedId,
    date: new Date().toISOString(),
    coffeeName: details.coffeeName?.trim() || '',
    notes: details.notes?.trim() || '',
    rating: normalizeRating(details.rating),
    tastingTags: normalizeTastingTags(details.tastingTags),
    coffeeGrams: normalizeCoffeeGrams(recipe),
    totalWater: recipe.totalWater,
    temperature: recipe.temperature,
    grindSize: recipe.grindSize,
    balance: recipe.balance,
    strengthPoursCount: recipe.strengthPoursCount,
    totalTime: recipe.totalTime,
    ratio: recipe.ratio,
    steps: [],
  };
}

const describeFailure = (error) => {
  if (error.status === 401) {
    return 'Sign in with Google to sync with your private history.';
  }

  if (error.status === 404 || error.offline) {
    return 'Cloud history is unreachable right now.';
  }

  return error.message || 'Cloud history is unavailable right now.';
};

const requestRemoteStorage = async (method, recipe) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  let response;

  try {
    response = await fetch(API_ENDPOINT, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: recipe ? JSON.stringify({ recipe }) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    const error = new Error('Network request failed.');

    error.offline = true;
    error.cause = cause;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload === null) {
    const error = new Error(payload?.error || 'Storage request failed.');

    error.status = response.ok ? 502 : response.status;
    throw error;
  }

  return payload;
};

let syncInFlight = null;

const runSync = async () => {
  for (const recipeId of readPendingDeletes()) {
    await requestRemoteStorage('DELETE', { id: recipeId });
    writePendingDeletes(readPendingDeletes().filter((id) => id !== recipeId));
  }

  for (const log of readLogs().filter((entry) => entry.pending)) {
    try {
      await requestRemoteStorage('PUT', toRemoteRecipe(log));
    } catch (error) {
      // The server rejected this recipe itself (bad data). Skip it so one bad
      // entry cannot block every other pending brew; it stays on this device.
      if (error.status === 400) {
        continue;
      }

      throw error;
    }

    // Only clear the flag if the recipe was not edited again meanwhile.
    writeLogs(readLogs().map((current) => {
      return current.id === log.id && JSON.stringify(current) === JSON.stringify(log)
        ? { ...current, pending: false }
        : current;
    }));
  }
};

// Sends everything that is still waiting on this device. Never throws.
export async function syncPendingChanges() {
  if (getPendingCount() === 0) {
    return { ok: true, pendingCount: 0 };
  }

  if (!syncInFlight) {
    syncInFlight = runSync().finally(() => {
      syncInFlight = null;
    });
  }

  try {
    await syncInFlight;
    return { ok: true, pendingCount: getPendingCount() };
  } catch (error) {
    return {
      ok: false,
      pendingCount: getPendingCount(),
      needsLogin: error.status === 401,
      message: describeFailure(error),
    };
  }
}

// Always resolves. `synced: false` means the list comes from this device only.
export async function loadBrewLogs() {
  const syncResult = await syncPendingChanges();

  try {
    const remoteLogs = await requestRemoteStorage('GET');

    if (!Array.isArray(remoteLogs)) {
      throw new Error('Unexpected response from cloud history.');
    }

    const pendingDeletes = new Set(readPendingDeletes());
    const pendingLogs = readLogs().filter((log) => log.pending);
    const pendingIds = new Set(pendingLogs.map((log) => log.id));
    const merged = [
      ...remoteLogs
        .filter((log) => !pendingIds.has(log.id) && !pendingDeletes.has(log.id))
        .map((log) => ({ ...log, pending: false })),
      ...pendingLogs,
    ];

    writeLogs(merged);

    return {
      logs: sortNewestFirst(merged),
      synced: syncResult.ok,
      needsLogin: Boolean(syncResult.needsLogin),
      message: syncResult.ok ? '' : syncResult.message,
    };
  } catch (error) {
    return {
      logs: getBrewLogs(),
      synced: false,
      needsLogin: error.status === 401,
      message: describeFailure(error),
    };
  }
}

// Saves (creates or updates) a brew. Always keeps it on this device.
export async function persistBrewLog(log) {
  const entry = upsertLocal(log, true);
  const syncResult = await syncPendingChanges();
  const stillPending = readLogs().some((current) => current.id === entry.id && current.pending);

  return {
    log: entry,
    synced: !stillPending,
    needsLogin: Boolean(syncResult.needsLogin),
    message: stillPending
      ? (syncResult.message || 'Cloud history rejected this recipe.')
      : '',
  };
}

export const persistUpdatedBrewLog = persistBrewLog;

export async function removeBrewLog(logId) {
  const id = String(logId);
  writeLogs(readLogs().filter((log) => log.id !== id));
  writePendingDeletes([...new Set([...readPendingDeletes(), id])]);

  const syncResult = await syncPendingChanges();

  return {
    synced: syncResult.ok,
    needsLogin: Boolean(syncResult.needsLogin),
    message: syncResult.ok ? '' : syncResult.message,
  };
}

// On logout, drop the cloud copy from this device but keep unsent brews.
export function clearSyncedCache() {
  writeLogs(readLogs().filter((log) => log.pending));
}
