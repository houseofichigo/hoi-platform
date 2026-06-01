import { useEffect, useRef } from "react";

/**
 * Debounced autosave. Calls `save(value)` after `delay` ms of inactivity.
 * Skips the first render (initial hydration) and skips when `value` is
 * deep-equal to the last persisted snapshot.
 */
export function useDebouncedAutosave<T>(
  value: T,
  save: (value: T) => Promise<void> | void,
  delay = 1500,
) {
  const isFirst = useRef(true);
  const lastSavedJson = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const json = JSON.stringify(value ?? null);
    if (isFirst.current) {
      isFirst.current = false;
      lastSavedJson.current = json;
      return;
    }
    if (json === lastSavedJson.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastSavedJson.current = json;
      void save(value);
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, save, delay]);
}
