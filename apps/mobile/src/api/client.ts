const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export async function api(path: string, init: RequestInit = {}, token?: string | null) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ code: "UNKNOWN", message: res.statusText }))) as {
      code?: string;
      message?: string;
    };
    throw Object.assign(new Error(body.message ?? "Request failed"), body);
  }
  return res.status === 204 ? null : res.json();
}
