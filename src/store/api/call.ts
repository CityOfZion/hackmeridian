import type { ApiError } from '@/api/types';
import i18n from '@/i18n';

/**
 * Resolves an API call into RTK Query's `{ data } | { error }` shape. Failures are printed to the Metro terminal in
 * development; `console.log` rather than `console.error`, so LogBox doesn't cover the screen's own error text.
 */
export async function call<T>(
  endpoint: string,
  args: unknown,
  request: () => Promise<T>,
): Promise<{ data: T } | { error: ApiError }> {
  try {
    return { data: await request() };
  } catch (error) {
    if (__DEV__) console.log(`[api] ${endpoint} failed`, args ?? '', error);
    return { error: { message: error instanceof Error ? error.message : i18n.t('common:errors.generic') } };
  }
}
