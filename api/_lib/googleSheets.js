import { createPrivateKey, sign } from 'node:crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_SHEET_NAME = 'Recipes';

const RECIPE_COLUMNS = [
  'id',
  'date',
  'coffeeName',
  'notes',
  'coffeeGrams',
  'totalWater',
  'temperature',
  'balance',
  'strengthPoursCount',
  'totalTime',
  'ratio',
  'stepsJson',
  'updatedAt',
];

let accessTokenCache = {
  expiresAt: 0,
  token: '',
};

const normalizeServiceAccountPrivateKey = (value) => {
  let normalized = String(value).trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  return normalized
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();
};

const encodeBase64Url = (value) => {
  return Buffer.from(value, 'utf8').toString('base64url');
};

const getSheetsConfig = () => {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || DEFAULT_SHEET_NAME;

  if (!serviceAccountEmail || !serviceAccountPrivateKey || !spreadsheetId) {
    throw new Error(
      'Google Sheets is not configured. Add GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID.',
    );
  }

  return {
    serviceAccountEmail,
    serviceAccountPrivateKey: normalizeServiceAccountPrivateKey(serviceAccountPrivateKey),
    spreadsheetId,
    sheetName,
  };
};

const getLastColumnLetter = () => {
  let index = RECIPE_COLUMNS.length;
  let label = '';

  while (index > 0) {
    const remainder = (index - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    index = Math.floor((index - 1) / 26);
  }

  return label;
};

const buildSheetRange = (range) => {
  const { sheetName } = getSheetsConfig();
  const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;

  return `${escapedSheetName}!${range}`;
};

const createServiceAccountJwt = () => {
  const config = getSheetsConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
  }));
  const claims = encodeBase64Url(JSON.stringify({
    iss: config.serviceAccountEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }));
  let privateKey;

  try {
    privateKey = createPrivateKey(config.serviceAccountPrivateKey);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is invalid. In Vercel, paste only the private_key value from the JSON key, keep BEGIN/END PRIVATE KEY, and do not wrap it in extra quotes.',
    );
  }

  const signature = sign(
    'RSA-SHA256',
    Buffer.from(`${header}.${claims}`),
    privateKey,
  ).toString('base64url');

  return `${header}.${claims}.${signature}`;
};

const getAccessToken = async () => {
  if (accessTokenCache.token && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createServiceAccountJwt(),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || 'Unable to authenticate with Google Sheets.');
  }

  accessTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (Number(payload.expires_in || 3600) * 1000),
  };

  return accessTokenCache.token;
};

const sheetRequest = async (path, init = {}) => {
  const { spreadsheetId } = getSheetsConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error?.message ||
      'Google Sheets request failed.';

    throw new Error(message);
  }

  return response;
};

const getSheetMetadata = async () => {
  const response = await sheetRequest('?fields=sheets(properties(sheetId,title))');
  return response.json();
};

const getSheetValues = async (range) => {
  const response = await sheetRequest(
    `/values/${encodeURIComponent(buildSheetRange(range))}`,
    {
      method: 'GET',
    },
  );
  const payload = await response.json();

  return payload.values || [];
};

const updateSheetValues = async (range, values) => {
  await sheetRequest(
    `/values/${encodeURIComponent(buildSheetRange(range))}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
  );
};

const appendSheetValues = async (range, values) => {
  await sheetRequest(
    `/values/${encodeURIComponent(buildSheetRange(range))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
  );
};

const deleteSheetRow = async (sheetId, rowNumber) => {
  await sheetRequest(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    }),
  });
};

const ensureSheetReady = async () => {
  const { sheetName } = getSheetsConfig();
  const metadata = await getSheetMetadata();
  const hasSheet = (metadata.sheets || []).some(
    (sheet) => sheet.properties?.title === sheetName,
  );

  if (!hasSheet) {
    await sheetRequest(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      }),
    });
  }

  const headerRow = await getSheetValues('1:1');

  if (
    headerRow.length === 0 ||
    RECIPE_COLUMNS.some((column, index) => headerRow[0]?.[index] !== column)
  ) {
    await updateSheetValues(`1:1`, [RECIPE_COLUMNS]);
  }
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseSteps = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const serializeRecipe = (recipe) => {
  const updatedAt = new Date().toISOString();

  return [
    String(recipe.id),
    recipe.date,
    recipe.coffeeName ?? '',
    recipe.notes ?? '',
    recipe.coffeeGrams,
    recipe.totalWater,
    recipe.temperature,
    recipe.balance,
    recipe.strengthPoursCount,
    recipe.totalTime,
    recipe.ratio ?? 15,
    JSON.stringify(recipe.steps ?? []),
    updatedAt,
  ];
};

const toRecipe = (row) => {
  const [
    id = '',
    date = '',
    coffeeName = '',
    notes = '',
    coffeeGrams = 0,
    totalWater = 0,
    temperature = 0,
    balance = 'balanced',
    strengthPoursCount = 2,
    totalTime = 0,
    ratio = 15,
    stepsJson = '[]',
    updatedAt = '',
  ] = row;

  return {
    id: String(id),
    date: String(date),
    coffeeName: String(coffeeName),
    notes: String(notes),
    coffeeGrams: parseNumber(coffeeGrams),
    totalWater: parseNumber(totalWater),
    temperature: parseNumber(temperature),
    balance: String(balance),
    strengthPoursCount: parseNumber(strengthPoursCount, 2),
    totalTime: parseNumber(totalTime),
    ratio: parseNumber(ratio, 15),
    steps: parseSteps(String(stepsJson)),
    updatedAt: String(updatedAt),
  };
};

const getRecipeRows = async () => {
  await ensureSheetReady();

  const rows = await getSheetValues(`A2:${getLastColumnLetter()}`);

  return rows
    .filter((row) => row[0])
    .map((row, index) => ({
      rowNumber: index + 2,
      recipe: toRecipe(row),
    }));
};

export const listRecipes = async () => {
  const rows = await getRecipeRows();

  return rows
    .map((entry) => entry.recipe)
    .sort((left, right) => {
      return new Date(right.date).getTime() - new Date(left.date).getTime();
    });
};

export const appendRecipe = async (recipe) => {
  await ensureSheetReady();
  await appendSheetValues(`A2:${getLastColumnLetter()}`, [serializeRecipe(recipe)]);

  return recipe;
};

export const updateRecipe = async (recipe) => {
  const rows = await getRecipeRows();
  const match = rows.find((entry) => entry.recipe.id === String(recipe.id));

  if (!match) {
    throw new Error('Recipe not found in Google Sheets.');
  }

  await updateSheetValues(
    `A${match.rowNumber}:${getLastColumnLetter()}${match.rowNumber}`,
    [serializeRecipe(recipe)],
  );

  return recipe;
};

export const deleteRecipe = async (recipeId) => {
  const { sheetName } = getSheetsConfig();
  const metadata = await getSheetMetadata();
  const sheet = (metadata.sheets || []).find(
    (entry) => entry.properties?.title === sheetName,
  );
  const rows = await getRecipeRows();
  const match = rows.find((entry) => entry.recipe.id === String(recipeId));

  if (!sheet?.properties?.sheetId || !match) {
    throw new Error('Recipe not found in Google Sheets.');
  }

  await deleteSheetRow(sheet.properties.sheetId, match.rowNumber);
  return { id: String(recipeId) };
};
