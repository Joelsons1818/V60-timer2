import { calculateRecipe } from './calculator';
import { normalizeRating, normalizeTastingTags } from './tasting';

export const balanceLabels = {
  acidity: 'Acidity',
  balanced: 'Balanced',
  sweet: 'Sweet',
};

const DEFAULT_RATIO = 15;
const DEFAULT_GRIND_SIZE = 130;
const DEFAULT_STRENGTH_POURS = 3;
const MIN_RATIO = 10;
const MAX_RATIO = 20;

const createDraftId = () => {
  return globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}`;
};

export const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

export const roundToOneDecimal = (value) => {
  return Math.round(value * 10) / 10;
};

export const normalizeCoffeeGrams = (coffeeGrams, totalWater, ratio) => {
  const parsedCoffee = parseNumber(coffeeGrams);

  if (parsedCoffee > 0) {
    return roundToOneDecimal(parsedCoffee);
  }

  const parsedWater = parseNumber(totalWater);
  const normalizedRatio = normalizeRatio(ratio);

  return parsedWater > 0 ? roundToOneDecimal(parsedWater / normalizedRatio) : 0;
};

export const normalizeRatio = (value) => {
  const parsed = parseNumber(value, DEFAULT_RATIO);

  return Math.round(clamp(parsed, MIN_RATIO, MAX_RATIO) * 2) / 2;
};

const normalizeGrindSize = (value) => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  return clamp(Math.round(parseNumber(value, 0)), 0, 200);
};

export const formatRatio = (ratio) => {
  const normalizedRatio = normalizeRatio(ratio);

  return Number.isInteger(normalizedRatio)
    ? String(normalizedRatio)
    : normalizedRatio.toFixed(1);
};

export const buildLogFromFields = (fields) => {
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
    rating: normalizeRating(fields.rating),
    tastingTags: normalizeTastingTags(fields.tastingTags),
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

export const createNewDraft = () => {
  return {
    ...buildLogFromFields({
      grindSize: DEFAULT_GRIND_SIZE,
      strengthPoursCount: DEFAULT_STRENGTH_POURS,
    }),
    isNew: true,
    isDuplicate: false,
  };
};

export const createDraft = (log) => {
  return {
    ...buildLogFromFields(log),
    isNew: false,
    isDuplicate: false,
  };
};

export const createDuplicateDraft = (log) => {
  const coffeeName = log.coffeeName?.trim();

  return {
    ...buildLogFromFields({
      ...log,
      id: '',
      date: new Date().toISOString(),
      coffeeName: coffeeName ? `${coffeeName} Copy` : 'Untitled Coffee Copy',
      notes: '',
      rating: 0,
      tastingTags: [],
    }),
    isNew: true,
    isDuplicate: true,
  };
};
