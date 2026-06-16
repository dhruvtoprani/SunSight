const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api";

export async function postJson<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> {
  const apiPath = path.startsWith("/") ? path : `/${path}`;
  const url = API_BASE_URL ? `${API_BASE_URL}${API_PREFIX}${apiPath}` : `${API_PREFIX}${apiPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}
