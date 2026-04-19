export const json = (body, init = {}) => {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  });
};

export const errorResponse = (message, status = 400) => {
  return json({ error: message }, { status });
};

export const readJsonBody = async (request) => {
  return request.json().catch(() => null);
};

export const rejectIfCrossOrigin = (request) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return null;
  }

  const origin = request.headers.get('origin');

  if (!origin) {
    return null;
  }

  const requestOrigin = new URL(request.url).origin;

  if (origin !== requestOrigin) {
    return 'Cross-site requests are not allowed.';
  }

  return null;
};
