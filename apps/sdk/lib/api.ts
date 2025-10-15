import { getToken } from "./auth";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export async function apiRequest(path: string, options: ApiRequestOptions = {}) {
  const { skipAuth, headers, body, ...rest } = options;
  const token = skipAuth ? null : await getToken();

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    ...rest,
  });

  if (!response.ok) {
    const errorText = await safeParseError(response);
    throw new Error(errorText ?? `Request failed with status ${response.status}`);
  }

  return response;
}

async function safeParseError(res: Response) {
  try {
    const data = await res.json();
    if (data?.message) return data.message as string;
    return JSON.stringify(data);
  } catch (err) {
    return null;
  }
}

export async function fetchJSON<T>(path: string, options: ApiRequestOptions = {}) {
  const response = await apiRequest(path, options);
  return (await response.json()) as T;
}
