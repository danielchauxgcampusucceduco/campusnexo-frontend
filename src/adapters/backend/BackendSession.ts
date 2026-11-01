/**
 * Sign-in against the Java backend. The token lives in localStorage with its expiry, so a link opened in another
 * tab keeps the session; an expired one is dropped when it is read. It is never in the bundle: the dashboard holds no
 * shared keys, only the session of the person who signed in.
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
  /** When the backend stops accepting the token (ISO-8601), or null when it did not say. */
  expiresAt: string | null;
}

export class BackendUnavailableError extends Error {}
export class LoginRequiredError extends Error {}
export class InvalidCredentialsError extends Error {}

const STORAGE_KEY = 'campusnexo.session';
/** When the login answer has no expiry: the backend's default token lifetime (APP_TOKEN_TTL). */
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 10_000;
const ROLES: readonly Role[] = ['VIEWER', 'OPERATOR', 'ADMIN', 'SENSOR'];

function parseSessionInfo(value: unknown): SessionInfo {
  if (typeof value !== 'object' || value === null) {
    throw new BackendUnavailableError('El servidor devolvió una sesión inválida');
  }
  const session = value as Record<string, unknown>;
  const validMode = session.mode === 'enforced' || session.mode === 'development';
  const validIdentity = session.authenticated === true
    ? typeof session.username === 'string' && session.username.length > 0 && ROLES.includes(session.role as Role)
    : session.authenticated === false && session.username === null && session.role === null;
  const validExpiry = session.expiresAt === null || (typeof session.expiresAt === 'string'
    && session.expiresAt.length > 0 && Number.isFinite(Date.parse(session.expiresAt)));
  if (!validMode || !validIdentity || !validExpiry) {
    throw new BackendUnavailableError('El servidor devolvió una sesión inválida');
  }
  return session as unknown as SessionInfo;
}

function parseCredentials(value: unknown): Credentials {
  if (typeof value !== 'object' || value === null) {
    throw new BackendUnavailableError('El servidor devolvió credenciales inválidas');
  }
  const credentials = value as Record<string, unknown>;
  if (typeof credentials.token !== 'string' || credentials.token.length === 0
      || typeof credentials.username !== 'string' || credentials.username.length === 0
      || !ROLES.includes(credentials.role as Role)) {
    throw new BackendUnavailableError('El servidor devolvió credenciales inválidas');
  }
  const expiresAt = typeof credentials.expiresAt === 'string' && Number.isFinite(Date.parse(credentials.expiresAt))
    ? credentials.expiresAt : null;
  return {
    token: credentials.token,
    username: credentials.username,
    role: credentials.role as Role,
    expiresAt,
  };
}

/** The saved token if it has not expired; an expired or unreadable entry is removed. */
export function storedToken(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown };
    if (typeof saved.token === 'string' && saved.token && typeof saved.expiresAt === 'number' && saved.expiresAt > now) {
      return saved.token;
    }
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked.
    }
    return null;
  }
}

export function storeToken(token: string | null, expiresAt: string | null = null, now = Date.now()): void {
  try {
    if (token) {
      const until = expiresAt ? Date.parse(expiresAt) : now + DEFAULT_TTL_MS;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt: until }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
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
    return parseSessionInfo(await response.json());
  } catch (error) {
    if (error instanceof BackendUnavailableError) throw error;
    throw new BackendUnavailableError(`No se pudo conectar con el servidor en ${apiBase}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function login(apiBase: string, username: string, password: string, timeoutMs = LOGIN_TIMEOUT_MS): Promise<Credentials> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
    if (response.status === 401) throw new InvalidCredentialsError('Usuario o contraseña incorrectos.');
    if (response.status === 429) throw new InvalidCredentialsError('Demasiados intentos: espera un minuto.');
    if (!response.ok) throw new BackendUnavailableError(`El servidor respondió HTTP ${response.status}`);
    const credentials = parseCredentials(await response.json());
    storeToken(credentials.token, credentials.expiresAt);
    return credentials;
  } catch (error) {
    if (error instanceof InvalidCredentialsError || error instanceof BackendUnavailableError) throw error;
    throw new BackendUnavailableError(`No se pudo completar el inicio de sesión en ${apiBase}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function logout(): void {
  storeToken(null);
}
