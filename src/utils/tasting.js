export const TASTING_TAG_OPTIONS = Object.freeze([
  { value: 'sweet', label: 'Sweet' },
  { value: 'acidic', label: 'Acidic' },
  { value: 'bitter', label: 'Bitter' },
  { value: 'weak', label: 'Weak' },
  { value: 'strong', label: 'Strong' },
]);

const TASTING_TAG_VALUES = new Set(TASTING_TAG_OPTIONS.map((option) => option.value));

export const normalizeRating = (value) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(parsed)));
};

export const normalizeTastingTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.filter((tag) => TASTING_TAG_VALUES.has(tag)))];
};

export const getTastingTagLabel = (value) => {
  return TASTING_TAG_OPTIONS.find((option) => option.value === value)?.label || value;
};
