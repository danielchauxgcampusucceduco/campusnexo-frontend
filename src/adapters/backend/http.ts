/**
 * REST client shared by the backend adapters. Every call carries the session token of the person who signed
 * in; errors keep the HTTP status and the stable `code` of the backend's ProblemDetail, so the UI can tell a
 * missing VPN (admin_network_required) from a missing role or a business rule.
 */
export class BackendError extends Error {
  constructor(readonly status: number, message: string, readonly code: string | null = null) {
    super(message);
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** 'blob' for file downloads; 'none' for 204 answers. */
  as?: 'json' | 'blob' | 'none';
  timeoutMs?: number;
}

export type Http = <T>(path: string, options?: RequestOptions) => Promise<T>;

const DEFAULT_TIMEOUT_MS = 10_000;

export function httpClient(apiBase: string, token: string | null, onUnauthorized: () => void): Http {
  return async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const { method = 'GET', body, query, as = 'json', timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    const headers: Record<string, string> = { Accept: as === 'blob' ? '*/*' : 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) params.set(key, String(value));
    const url = `${apiBase}${path}${params.size > 0 ? `?${params}` : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method, headers, signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new BackendError(0, 'El servidor tardó demasiado en responder');
      }
      throw new BackendError(0, 'No se pudo conectar con el servidor');
    } finally {
      clearTimeout(timeout);
    }
    // Expired or revoked session: the person must sign in again.
    if (response.status === 401) onUnauthorized();
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      let code: string | null = null;
      try {
        const problem = (await response.json()) as { detail?: string; code?: string };
        if (problem.detail) detail = problem.detail;
        if (problem.code) code = problem.code;
      } catch {
        // The body is not a ProblemDetail; keep the status line.
      }
      throw new BackendError(response.status, detail, code);
    }
    if (as === 'none') return undefined as T;
    if (as === 'blob') return (await response.blob()) as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new BackendError(response.status, 'El servidor devolvió una respuesta JSON inválida');
    }
  };
}
