/**
 * HTTP transport adapter — zastępuje `MockTransportAdapter` dla prawdziwego backendu.
 *
 * Użycie w `app.config.ts`:
 *   ```ts
 *   import { HttpTransportAdapter } from './bootstrap/http-transport';
 *
 *   provideEchelon({
 *     transport: new HttpTransportAdapter({ baseUrl: 'https://api.example.com' }),
 *     ...
 *   })
 *   ```
 *
 * Mapowanie channel → URL:
 *   channel 'client-by-id'  + params { id: '123' }  → GET  /api/client-by-id?id=123
 *   channel 'client-update' + body   { ... }         → POST /api/client-update
 *   channel 'client-delete' + params { id: '123' }   → DELETE /api/client-delete/123
 *
 * Możesz nadpisać mapowanie przez `channelMap` w konfiguracji.
 */
import type { TransportAdapter, TransportRequest, TransportResponse } from '@echelon-framework/core';
import { Observable, Subject } from 'rxjs';

export interface ChannelDef {
  /** HTTP method. Default: GET dla query-style, POST dla operacji. */
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Ścieżka URL (bez baseUrl). Wspiera `:param` tokens. Default: `/<channel>`. */
  readonly path?: string;
  /** Gdy true → params trafiają do body zamiast query string. */
  readonly useBody?: boolean;
}

export interface HttpTransportOptions {
  /** Bazowy URL serwera, np. `https://api.example.com` lub `/api`. */
  readonly baseUrl: string;
  /** Nadpisanie zachowania per channel. */
  readonly channelMap?: Readonly<Record<string, ChannelDef>>;
  /** Domyślne nagłówki (np. Authorization). */
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  /** Timeout w ms (default: 30 000). */
  readonly timeoutMs?: number;
}

export class HttpTransportAdapter implements TransportAdapter {
  readonly kind = 'http';

  private readonly pushSubjects = new Map<string, Subject<TransportResponse<unknown>>>();

  constructor(private readonly opts: HttpTransportOptions) {}

  async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
    const def: ChannelDef = this.opts.channelMap?.[req.channel] ?? {};
    const method = def.method ?? this.inferMethod(req.channel);
    const path = def.path ?? `/${req.channel}`;
    const params = (req.params ?? req.body ?? {}) as Record<string, unknown>;

    const url = this.buildUrl(path, params, method, def.useBody ?? false);
    const init = this.buildInit(method, params, def.useBody ?? false);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 30_000);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new HttpError(res.status, text, req.channel);
      }

      const data = await res.json() as T;
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { data, headers, at: Date.now() };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  subscribe<T>(req: TransportRequest): Observable<TransportResponse<T>> {
    // Dla SSE/WebSocket — uproszczona implementacja (push z serwera).
    // Produkcyjnie tu byłby EventSource lub WebSocket.
    const key = req.channel;
    let subj = this.pushSubjects.get(key);
    if (subj === undefined) {
      subj = new Subject<TransportResponse<unknown>>();
      this.pushSubjects.set(key, subj);
    }
    return subj.asObservable() as Observable<TransportResponse<T>>;
  }

  private inferMethod(channel: string): 'GET' | 'POST' {
    // Konwencja: kanały z prefiksem create/update/delete/save → POST; reszta → GET.
    return /^(create|update|delete|save|tx-create|user-create|user-update|user-delete|client-update)/.test(channel)
      ? 'POST' : 'GET';
  }

  private buildUrl(
    path: string,
    params: Record<string, unknown>,
    method: string,
    useBody: boolean,
  ): string {
    // Interpoluj :param tokeny z params
    let resolved = path.replace(/:([a-zA-Z_]+)/g, (_, key: string) => {
      const v = params[key];
      return v !== undefined ? encodeURIComponent(String(v)) : `:${key}`;
    });

    const base = this.opts.baseUrl.replace(/\/$/, '');
    const fullUrl = `${base}${resolved}`;

    // GET/DELETE → query string
    if ((method === 'GET' || method === 'DELETE') && !useBody) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      return qs.length > 0 ? `${fullUrl}?${qs}` : fullUrl;
    }

    return fullUrl;
  }

  private buildInit(method: string, params: Record<string, unknown>, useBody: boolean): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.opts.defaultHeaders ?? {}),
    };

    if (method === 'GET' || (method === 'DELETE' && !useBody)) {
      return { method, headers };
    }

    return { method, headers, body: JSON.stringify(params) };
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly channel: string,
  ) {
    super(`HTTP ${status} on channel "${channel}": ${body}`);
    this.name = 'HttpError';
  }
}
