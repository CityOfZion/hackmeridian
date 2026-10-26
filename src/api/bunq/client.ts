import i18n from '@/i18n';
import { randomHex } from '@/utils/ids';

/**
 * bunq production: cards and limits are real money. The app talks to bunq directly until the COZ backend holds the
 * bunq credentials (spec). EXPO_PUBLIC_ values are bundled into the app, so the API key is readable by anyone who has
 * the build.
 */
const BUNQ_BASE_URL = 'https://api.bunq.com/v1';

export class BunqError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** bunq wraps every result: `{ "Response": [{ "Id": {...} }, { "Token": {...} }] }`. */
type BunqResponse = Record<string, unknown>[];

type RequestOptions = {
  body?: unknown;
  /** `X-Bunq-Client-Authentication`: installation token for device and session calls, session token after. */
  token?: string;
  /** `X-Bunq-Client-Signature` for the serialized body; required by session and payment-creating calls. */
  sign?: (body: string) => string;
};

export async function bunqRequest(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  { body, token, sign }: RequestOptions = {},
): Promise<BunqResponse> {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'User-Agent': 'VaultPass/1.0',
    'X-Bunq-Language': 'en_US',
    'X-Bunq-Region': 'nl_NL',
    'X-Bunq-Geolocation': '0 0 0 0 000',
    // Makes retries idempotent
    'X-Bunq-Client-Request-Id': randomHex(16),
  };
  if (token) headers['X-Bunq-Client-Authentication'] = token;
  if (sign && serialized !== undefined) headers['X-Bunq-Client-Signature'] = sign(serialized);

  const startedAt = Date.now();
  const response = await fetch(`${BUNQ_BASE_URL}${path}`, { method, headers, body: serialized });
  const json = (await response.json().catch(() => ({}))) as {
    Response?: BunqResponse;
    Error?: { error_description_translated?: string; error_description?: string }[];
  };

  if (!response.ok || !json.Response) {
    const error = json.Error?.[0];
    const message =
      error?.error_description_translated ??
      error?.error_description ??
      i18n.t('common:errors.bunq.answered', { status: response.status });
    // Method, path, status and bunq's message only: headers carry the session token
    console.log(`[bunq] ${method} ${path} → ${response.status} (${Date.now() - startedAt}ms): ${message}`);
    throw new BunqError(message, response.status);
  }
  // Every call, in all builds (adb logcat on a release APK); never headers or bodies
  console.log(`[bunq] ${method} ${path} → ${response.status} (${Date.now() - startedAt}ms)`);
  return json.Response;
}

/** The object under `key` in a bunq response, e.g. `pick(response, 'Token')`. */
export function pick<T>(response: BunqResponse, key: string): T | undefined {
  return response.find((item) => key in item)?.[key] as T | undefined;
}

/** List endpoints wrap each item in its type name (`{ "CardDebit": {...} }`); unwrap them. */
export function unwrapList<T>(response: BunqResponse): T[] {
  return response.map((item) => Object.values(item)[0] as T);
}
