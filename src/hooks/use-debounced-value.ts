import { useEffect, useState } from 'react';

/** `value` once it has stopped changing for `delayMs` (e.g. an amount typed on a keypad, before quoting it). */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
