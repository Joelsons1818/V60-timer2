import { balanceLabels, buildLogFromFields, formatRatio } from './brewLog';

// A shared recipe is just a link: every setting travels in the URL, so the
// person who opens it needs no login and no access to the private history.
const SHARE_FLAG = 'shared';
const MAX_TEXT_LENGTH = 300;

const cleanText = (value) => {
  return String(value ?? '').trim().slice(0, MAX_TEXT_LENGTH);
};

export const buildShareUrl = (log) => {
  const recipe = buildLogFromFields(log);
  const params = new URLSearchParams({
    [SHARE_FLAG]: '1',
    w: String(recipe.totalWater),
    c: String(recipe.coffeeGrams),
    r: String(recipe.ratio),
    t: String(recipe.temperature),
    b: recipe.balance,
    p: String(recipe.strengthPoursCount),
  });

  if (recipe.grindSize !== '') {
    params.set('g', String(recipe.grindSize));
  }

  if (recipe.coffeeName) {
    params.set('n', cleanText(recipe.coffeeName));
  }

  if (recipe.notes) {
    params.set('o', cleanText(recipe.notes));
  }

  return `${window.location.origin}/?${params.toString()}`;
};

export const buildShareText = (log) => {
  const recipe = buildLogFromFields(log);
  const lines = [
    `V60 4:6 recipe${recipe.coffeeName ? ` - ${recipe.coffeeName}` : ''}`,
    `${recipe.coffeeGrams}g coffee, ${recipe.totalWater}ml water (1:${formatRatio(recipe.ratio)}), ${recipe.temperature}°C`,
    `${balanceLabels[recipe.balance]}, ${recipe.strengthPoursCount} strength pours${recipe.grindSize === '' ? '' : `, grind ${recipe.grindSize}`}`,
  ];

  if (recipe.notes) {
    lines.push(recipe.notes);
  }

  return lines.join('\n');
};

// Reads a shared recipe from the page address. Every value is re-validated
// by buildLogFromFields, so a tampered link can only produce a valid recipe.
export const parseSharedRecipe = (search = window.location.search) => {
  const params = new URLSearchParams(search);

  if (params.get(SHARE_FLAG) !== '1' || !params.get('w')) {
    return null;
  }

  return buildLogFromFields({
    totalWater: params.get('w'),
    coffeeGrams: params.get('c'),
    ratio: params.get('r'),
    temperature: params.get('t'),
    grindSize: params.get('g') ?? '',
    balance: params.get('b'),
    strengthPoursCount: params.get('p'),
    coffeeName: cleanText(params.get('n')),
    notes: cleanText(params.get('o')),
  });
};

export const clearSharedRecipeFromUrl = () => {
  window.history.replaceState(null, '', window.location.pathname);
};

// Returns 'shared' (native share sheet), 'copied' (clipboard), 'cancelled' or 'failed'.
export const shareRecipe = async (log) => {
  const url = buildShareUrl(log);
  const text = buildShareText(log);

  if (navigator.share) {
    try {
      await navigator.share({ title: 'V60 Recipe', text, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch (error) {
    console.error('Failed to share recipe', error);
    return 'failed';
  }
};
