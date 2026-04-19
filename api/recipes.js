import { appendRecipe, listRecipes, updateRecipe } from './_lib/googleSheets.js';
import { errorResponse, json, readJsonBody, rejectIfCrossOrigin } from './_lib/http.js';
import { getSessionFromRequest } from './_lib/session.js';

const REQUIRED_FIELDS = [
  'id',
  'date',
  'coffeeGrams',
  'totalWater',
  'temperature',
  'balance',
  'strengthPoursCount',
  'totalTime',
  'ratio',
  'steps',
];

const validateRecipe = (recipe) => {
  if (!recipe || typeof recipe !== 'object') {
    return 'Recipe payload is required.';
  }

  for (const field of REQUIRED_FIELDS) {
    if (recipe[field] === undefined || recipe[field] === null) {
      return `Missing field: ${field}`;
    }
  }

  if (!Array.isArray(recipe.steps)) {
    return 'Steps must be an array.';
  }

  return null;
};

const requireSession = (request) => {
  const session = getSessionFromRequest(request);

  if (!session) {
    throw new Error('Please sign in with Google to access your brew history.');
  }

  return session;
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/recipes') {
      return errorResponse('Not found.', 404);
    }

    const crossOriginError = rejectIfCrossOrigin(request);

    if (crossOriginError) {
      return errorResponse(crossOriginError, 403);
    }

    try {
      requireSession(request);
    } catch (error) {
      return errorResponse(error.message, 401);
    }

    try {
      if (request.method === 'GET') {
        return json(await listRecipes());
      }

      if (request.method === 'POST') {
        const payload = await readJsonBody(request);
        const recipe = payload?.recipe;
        const validationError = validateRecipe(recipe);

        if (validationError) {
          return errorResponse(validationError, 400);
        }

        return json(await appendRecipe(recipe), { status: 201 });
      }

      if (request.method === 'PUT') {
        const payload = await readJsonBody(request);
        const recipe = payload?.recipe;
        const validationError = validateRecipe(recipe);

        if (validationError) {
          return errorResponse(validationError, 400);
        }

        return json(await updateRecipe(recipe));
      }

      return errorResponse('Method not allowed.', 405);
    } catch (error) {
      console.error('Recipe API failed', error);
      return errorResponse(
        error.message || 'Unable to access recipe storage.',
        500,
      );
    }
  },
};
