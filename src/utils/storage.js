import { normalizeRating, normalizeTastingTags } from './tasting';

const STORAGE_KEY = 'v60_brew_logs';
const API_ENDPOINT = '/api/recipes';
const isDevelopment = import.meta.env.DEV;

const cloneSteps = (steps = []) => {
  return steps.map((step) => ({
    ...step,
  }));
};

const readLogs = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const logs = saved ? JSON.parse(saved) : [];

    return Array.isArray(logs) ? logs : [];
  } catch (error) {
    console.error('Failed to read saved brews', error);
    return [];
  }
};

const writeLogs = (logs) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
};

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

export function getBrewLogs() {
  return readLogs();
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

export function saveBrewLog(log) {
  const logs = readLogs();
  logs.push(log);
  writeLogs(logs);
  return logs;
}

export function updateBrewLog(updatedLog) {
  const logs = readLogs().map((log) => {
    if (log.id !== updatedLog.id) {
      return log;
    }

    return {
      ...updatedLog,
      steps: cloneSteps(updatedLog.steps),
    };
  });

  writeLogs(logs);
  return logs;
}

export function deleteBrewLog(logId) {
  const logs = readLogs().filter((log) => log.id !== logId);
  writeLogs(logs);
  return logs;
}

const normalizeError = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);
  return payload?.error || fallbackMessage;
};

const requestRemoteStorage = async (method, recipe) => {
  const response = await fetch(API_ENDPOINT, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: recipe ? JSON.stringify({ recipe }) : undefined,
  });

  if (!response.ok) {
    throw new Error(await normalizeError(response, 'Storage request failed.'));
  }

  return response.json();
};

export async function loadBrewLogs() {
  try {
    return await requestRemoteStorage('GET');
  } catch (error) {
    if (isDevelopment) {
      return readLogs().slice().reverse();
    }

    throw error;
  }
}

export async function persistBrewLog(log) {
  try {
    return await requestRemoteStorage('POST', log);
  } catch (error) {
    if (isDevelopment) {
      saveBrewLog(log);
      return log;
    }

    throw error;
  }
}

export async function persistUpdatedBrewLog(log) {
  try {
    return await requestRemoteStorage('PUT', log);
  } catch (error) {
    if (isDevelopment) {
      updateBrewLog(log);
      return log;
    }

    throw error;
  }
}

export async function removeBrewLog(logId) {
  try {
    await requestRemoteStorage('DELETE', { id: logId });
    return logId;
  } catch (error) {
    if (isDevelopment) {
      deleteBrewLog(logId);
      return logId;
    }

    throw error;
  }
}
