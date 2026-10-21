/**
 * Sign-in against the Java backend. The token lives in sessionStorage (cleared when the tab closes), never
 * in the bundle: the dashboard holds no shared keys, only the session of the person who signed in.
 */
export type Role = 'VIEWER' | 'OPERATOR' | 'ADMIN' | 'SENSOR';

export interface SessionInfo {
  mode: 'enforced' | 'development';
  authenticated: boolean;
  username: string | null;
  role: Role | null;
  expiresAt: string | null;
}

export interface Credentials {
  token: string | null;
  username: string;
  role: Role;
}

export class BackendUnavailableError extends Error {}
export class LoginRequiredError extends Error {}
export class InvalidCredentialsError extends Error {}

const STORAGE_KEY = 'campusnexo.session';

export function storedToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the session lasts until the page is reloaded.
  }
}

/** Public endpoint: tells whether sign-in is required and who the token belongs to. */
export async function fetchSession(apiBase: string, token: string | null, timeoutMs: number): Promise<SessionInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBase}/auth/session`, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new BackendUnavailableError(`El servidor respondió HTTP ${response.status}`);
    return (await response.json()) as SessionInfo;
  } catch (error) {
    if (error instanceof BackendUnavailableError) throw error;
    throw new BackendUnavailableError(`No se pudo conectar con el servidor en ${apiBase}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function login(apiBase: string, username: string, password: string): Promise<Credentials> {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (response.status === 401) throw new InvalidCredentialsError('Usuario o contraseña incorrectos.');
  if (response.status === 429) throw new InvalidCredentialsError('Demasiados intentos: espera un minuto.');
  if (!response.ok) throw new BackendUnavailableError(`El servidor respondió HTTP ${response.status}`);
  const body = (await response.json()) as { token: string; username: string; role: Role };
  storeToken(body.token);
  return { token: body.token, username: body.username, role: body.role };
}

export function logout(): void {
  storeToken(null);
}
