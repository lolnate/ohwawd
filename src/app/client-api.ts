export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch {
      if (!response.ok) throw new Error(`${fallback} (${response.status})`);
      throw new Error(`${fallback}: the server returned an invalid response.`);
    }
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null;
    throw new Error(message || `${fallback} (${response.status})`);
  }
  return data as T;
}

export async function apiRequest<T>(path: string, method = "GET", body?: unknown, fallback = "Request failed"): Promise<T> {
  const response = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return readApiResponse<T>(response, fallback);
}
