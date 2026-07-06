const RECIPE_SETTINGS_KEY = 'v60_recipe_settings';
const LAST_COFFEE_NAME_KEY = 'v60_last_coffee_name';

export const ORIGINAL_RECIPE_SETTINGS = Object.freeze({
  totalWater: 300,
  ratio: 15,
  grindSize: 130,
  temperature: 92,
  strengthPours: 3,
});

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRatio = (value) => {
  const parsed = parseNumber(value, ORIGINAL_RECIPE_SETTINGS.ratio);
  return Math.round(clamp(parsed, 10, 20) * 2) / 2;
};

const normalizePositiveInteger = (value, fallback, min, max) => {
  const parsed = Math.round(parseNumber(value, fallback));
  return clamp(parsed, min, max);
};

const normalizeSettings = (settings = {}) => {
  const ratio = normalizeRatio(settings.ratio);

  return {
    totalWater: normalizePositiveInteger(settings.totalWater, ORIGINAL_RECIPE_SETTINGS.totalWater, 150, 1500),
    ratio,
    grindSize: normalizePositiveInteger(settings.grindSize, ORIGINAL_RECIPE_SETTINGS.grindSize, 0, 200),
    temperature: normalizePositiveInteger(settings.temperature, ORIGINAL_RECIPE_SETTINGS.temperature, 75, 100),
    strengthPours: normalizePositiveInteger(settings.strengthPours, ORIGINAL_RECIPE_SETTINGS.strengthPours, 2, 5),
  };
};

export const getOriginalRecipeSettings = () => {
  return { ...ORIGINAL_RECIPE_SETTINGS };
};

export const getSavedRecipeSettings = () => {
  try {
    const saved = localStorage.getItem(RECIPE_SETTINGS_KEY);

    if (!saved) {
      return getOriginalRecipeSettings();
    }

    return normalizeSettings(JSON.parse(saved));
  } catch (error) {
    console.error('Failed to read recipe settings', error);
    return getOriginalRecipeSettings();
  }
};

export const saveRecipeSettings = (settings) => {
  const normalizedSettings = normalizeSettings(settings);

  try {
    localStorage.setItem(RECIPE_SETTINGS_KEY, JSON.stringify(normalizedSettings));
  } catch (error) {
    console.error('Failed to save recipe settings', error);
  }

  return normalizedSettings;
};

export const resetRecipeSettings = () => {
  const originalSettings = getOriginalRecipeSettings();

  try {
    localStorage.setItem(RECIPE_SETTINGS_KEY, JSON.stringify(originalSettings));
  } catch (error) {
    console.error('Failed to reset recipe settings', error);
  }

  return originalSettings;
};

export const getLastCoffeeName = () => {
  try {
    return localStorage.getItem(LAST_COFFEE_NAME_KEY) || '';
  } catch (error) {
    console.error('Failed to read last coffee name', error);
    return '';
  }
};

export const saveLastCoffeeName = (coffeeName) => {
  const normalizedName = String(coffeeName ?? '').trim();

  try {
    if (normalizedName) {
      localStorage.setItem(LAST_COFFEE_NAME_KEY, normalizedName);
    } else {
      localStorage.removeItem(LAST_COFFEE_NAME_KEY);
    }
  } catch (error) {
    console.error('Failed to save last coffee name', error);
  }

  return normalizedName;
};
